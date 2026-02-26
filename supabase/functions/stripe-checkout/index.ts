import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "http://localhost:3000";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

/** Map plan names to Stripe Price IDs (configure in env or Stripe dashboard). */
const PLAN_PRICE_IDS: Record<string, string> = {
  starter: Deno.env.get("STRIPE_PRICE_STARTER") || "price_starter_placeholder",
  growth: Deno.env.get("STRIPE_PRICE_GROWTH") || "price_growth_placeholder",
  scale: Deno.env.get("STRIPE_PRICE_SCALE") || "price_scale_placeholder",
};

const PLAN_NAMES: Record<string, string> = {
  starter: "Starter ($29/mo)",
  growth: "Growth ($79/mo)",
  scale: "Scale ($149/mo)",
};

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    const { plan } = await req.json();

    if (!plan || !PLAN_PRICE_IDS[plan]) {
      return json(
        { detail: `Invalid plan. Choose: ${Object.keys(PLAN_PRICE_IDS).join(", ")}` },
        cors,
        400,
      );
    }

    // Get user profile for email
    const { data: profile } = await sb
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();

    if (!profile) {
      return json({ detail: "Profile not found" }, cors, 404);
    }

    // Check for existing Stripe customer
    let stripeCustomerId: string | null = null;

    const { data: existingSub } = await sb
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("owner_id", userId)
      .limit(1)
      .maybeSingle();

    if (existingSub?.stripe_customer_id) {
      stripeCustomerId = existingSub.stripe_customer_id;
    } else {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: { supabase_user_id: userId },
      });
      stripeCustomerId = customer.id;
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [
        {
          price: PLAN_PRICE_IDS[plan],
          quantity: 1,
        },
      ],
      success_url: `${FRONTEND_URL}/dashboard?checkout=success&plan=${plan}`,
      cancel_url: `${FRONTEND_URL}/pricing?checkout=canceled`,
      subscription_data: {
        metadata: {
          supabase_user_id: userId,
          plan,
        },
      },
      metadata: {
        supabase_user_id: userId,
        plan,
      },
    });

    return json({ data: { url: session.url } }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }
    console.error("stripe-checkout error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
