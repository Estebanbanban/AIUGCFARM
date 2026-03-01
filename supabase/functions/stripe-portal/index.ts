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

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    // Get user's Stripe customer ID from their subscription
    const { data: subscription, error } = await sb
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("owner_id", userId)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`DB error: ${error.message}`);

    let customerId = subscription?.stripe_customer_id;

    // Fallback: look up Stripe customer by email for pack-only buyers
    if (!customerId) {
      const { data: profile } = await sb
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .single();

      if (profile?.email) {
        const customers = await stripe.customers.list({
          email: profile.email,
          limit: 1,
        });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }
      }
    }

    if (!customerId) {
      return json(
        { detail: "No billing account found. Make a purchase first." },
        cors,
        404,
      );
    }

    // Create billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${FRONTEND_URL}/settings`,
    });

    return json({ data: { url: portalSession.url } }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }
    console.error("stripe-portal error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
