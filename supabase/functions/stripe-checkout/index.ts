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

/** Subscription plan → Stripe recurring Price ID (monthly) */
const PLAN_PRICE_IDS_MONTHLY: Record<string, string | undefined> = {
  starter: Deno.env.get("STRIPE_PRICE_STARTER"),
  growth: Deno.env.get("STRIPE_PRICE_GROWTH"),
  scale: Deno.env.get("STRIPE_PRICE_SCALE"),
};

/** Subscription plan → Stripe recurring Price ID (annual) */
const PLAN_PRICE_IDS_ANNUAL: Record<string, string | undefined> = {
  starter: Deno.env.get("STRIPE_PRICE_STARTER_ANNUAL"),
  growth: Deno.env.get("STRIPE_PRICE_GROWTH_ANNUAL"),
  scale: Deno.env.get("STRIPE_PRICE_SCALE_ANNUAL"),
};

const PLAN_NAMES: Record<string, Record<string, string>> = {
  starter: { monthly: "Starter ($25/mo)", annual: "Starter Annual ($20/mo)" },
  growth:  { monthly: "Growth ($80/mo)",  annual: "Growth Annual ($64/mo)"  },
  scale:   { monthly: "Scale ($180/mo)",  annual: "Scale Annual ($144/mo)"  },
};

/** Credit pack → Stripe one-time Price ID */
const PACK_PRICE_IDS: Record<string, string | undefined> = {
  pack_10: Deno.env.get("STRIPE_PRICE_PACK_10"),
  pack_30: Deno.env.get("STRIPE_PRICE_PACK_30"),
  pack_100: Deno.env.get("STRIPE_PRICE_PACK_100"),
  // Single-video paywall purchases
  single_standard: Deno.env.get("STRIPE_PRICE_SINGLE_STANDARD"),
  single_hd: Deno.env.get("STRIPE_PRICE_SINGLE_HD"),
};

const PACK_NAMES: Record<string, string> = {
  pack_10: "10 Credits: Starter Pack ($12)",
  pack_30: "30 Credits: Creator Pack ($33)",
  pack_100: "100 Credits: Pro Pack ($95)",
  single_standard: "5 Credits: Single Standard Video ($5)",
  single_hd: "10 Credits: Single HD Video ($10)",
};

/**
 * Allowlist of Stripe coupon IDs accepted from the client.
 * t9QmsQTe = NewUsers (30% off once): first-paywall 30-min offer
 * yGuI3xvT = 50percent (50% off once, Starter only) — first-video offer
 */
const ALLOWED_COUPONS = new Set(["t9QmsQTe", "yGuI3xvT"]);

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    const body = await req.json();
    const { plan, pack, couponId, billing } = body;
    const isAnnual = billing === "annual";

    if (!plan && !pack) {
      return json({ detail: "Provide either 'plan' or 'pack'" }, cors, 400);
    }

    // Validate coupon if provided
    const validatedCoupon =
      couponId && typeof couponId === "string" && ALLOWED_COUPONS.has(couponId)
        ? couponId
        : null;

    // Get user profile for email
    const { data: profile } = await sb
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();

    if (!profile) {
      return json({ detail: "Profile not found" }, cors, 404);
    }

    // Get or create Stripe customer
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
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: { supabase_user_id: userId },
      });
      stripeCustomerId = customer.id;
    }

    // ── Credit pack (one-time payment) ────────────────────────────────────────
    if (pack) {
      const priceId = PACK_PRICE_IDS[pack];
      if (!priceId) {
        console.error(`Stripe price ID not configured for pack: ${pack}`);
        return json(
          { detail: "This credit pack is not available right now." },
          cors,
          503,
        );
      }

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: stripeCustomerId,
        mode: "payment",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${FRONTEND_URL}/dashboard?checkout=success&pack=${pack}`,
        cancel_url: `${FRONTEND_URL}/settings/billing?checkout=cancelled`,
        metadata: {
          supabase_user_id: userId,
          pack,
        },
      };

      if (validatedCoupon) {
        sessionParams.discounts = [{ coupon: validatedCoupon }];
      } else {
        sessionParams.allow_promotion_codes = true;
      }

      const session = await stripe.checkout.sessions.create(sessionParams);
      return json({ data: { url: session.url } }, cors);
    }

    // ── Subscription ──────────────────────────────────────────────────────────
    const priceIdMap = isAnnual ? PLAN_PRICE_IDS_ANNUAL : PLAN_PRICE_IDS_MONTHLY;
    const priceId = priceIdMap[plan];
    if (!priceId) {
      // Fallback to monthly if annual not configured
      const fallback = PLAN_PRICE_IDS_MONTHLY[plan];
      if (!fallback) {
        console.error(`Stripe price ID not configured for plan: ${plan} (${billing ?? "monthly"})`);
        return json(
          { detail: "Checkout is not available right now. Please try again later." },
          cors,
          503,
        );
      }
      console.warn(`Annual price not configured for ${plan}, falling back to monthly`);
    }
    const resolvedPriceId = priceId ?? PLAN_PRICE_IDS_MONTHLY[plan]!;
    const planName = PLAN_NAMES[plan]?.[isAnnual ? "annual" : "monthly"] ?? plan;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      success_url: `${FRONTEND_URL}/dashboard?checkout=success&plan=${plan}`,
      cancel_url: `${FRONTEND_URL}/pricing?checkout=canceled`,
      subscription_data: {
        metadata: { supabase_user_id: userId, plan },
      },
      metadata: {
        supabase_user_id: userId,
        plan,
      },
    };
    void planName; // used for logging only

    if (validatedCoupon) {
      sessionParams.discounts = [{ coupon: validatedCoupon }];
    } else {
      sessionParams.allow_promotion_codes = true;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
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
