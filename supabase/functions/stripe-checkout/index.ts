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
  growth:  Deno.env.get("STRIPE_PRICE_GROWTH"),
  scale:   Deno.env.get("STRIPE_PRICE_SCALE"),
};

/** Subscription plan → Stripe recurring Price ID (annual — hardcoded as fallback) */
const PLAN_PRICE_IDS_ANNUAL: Record<string, string> = {
  starter: Deno.env.get("STRIPE_PRICE_STARTER_ANNUAL") ?? "price_1T661MDofGNcXNHKPIpj3KOE",
  growth:  Deno.env.get("STRIPE_PRICE_GROWTH_ANNUAL")  ?? "price_1T662PDofGNcXNHKinIVq4Ft",
  scale:   Deno.env.get("STRIPE_PRICE_SCALE_ANNUAL")   ?? "price_1T663BDofGNcXNHKAymouo25",
};

/** Credit pack → Stripe one-time Price ID */
const PACK_PRICE_IDS: Record<string, string | undefined> = {
  pack_10: Deno.env.get("STRIPE_PRICE_PACK_10"),
  pack_30: Deno.env.get("STRIPE_PRICE_PACK_30"),
  pack_100: Deno.env.get("STRIPE_PRICE_PACK_100"),
  // Single-video paywall purchases (price IDs are not secrets — hardcoded as fallback)
  single_standard: Deno.env.get("STRIPE_PRICE_SINGLE_STANDARD") ?? "price_1T65y1DofGNcXNHKBXaliSF2",
  single_hd:       Deno.env.get("STRIPE_PRICE_SINGLE_HD")       ?? "price_1T65zBDofGNcXNHKMYvxgyuw",
};

const PACK_NAMES: Record<string, string> = {
  pack_10: "10 Credits: Starter Pack ($12)",
  pack_30: "30 Credits: Creator Pack ($33)",
  pack_100: "100 Credits: Pro Pack ($95)",
  single_standard: "5 Credits: Single Standard Video ($5)",
  single_hd: "10 Credits: Single HD Video ($10)",
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

    const body = await req.json();
    const { plan, pack, couponId, billing, generation_id } = body;
    const isAnnual = billing === "annual";

    if (!plan && !pack) {
      return json({ detail: "Provide either 'plan' or 'pack'" }, cors, 400);
    }

    // Validate discount against Stripe API.
    // Supports both Coupon IDs (e.g. "t9QmsQTe") and Promotion Code IDs (e.g. "promo_1T5...").
    // Coupon flow:
    //   - Single-video purchase     → client sends COUPON_50_OFF_FIRST_VIDEO (promo_)
    //   - Starter subscription      → client sends COUPON_50_OFF_STARTER (promo_)
    //   - Growth/Scale subscription → client sends COUPON_30_OFF (promo_)
    //   - Credit packs              → no coupon
    // If the discount is invalid/expired, we fall back to allow_promotion_codes.
    let validatedCoupon: string | null = null;
    let validatedPromoCode: string | null = null;
    if (couponId && typeof couponId === "string") {
      const isPromoCode = couponId.startsWith("promo_");
      try {
        if (isPromoCode) {
          const promoCode = await stripe.promotionCodes.retrieve(couponId);
          if (promoCode.active && promoCode.coupon?.valid) {
            validatedPromoCode = couponId;
          } else {
            console.warn(`stripe-checkout: promotion code "${couponId}" is inactive or its coupon is invalid. Falling back to allow_promotion_codes.`);
          }
        } else {
          const coupon = await stripe.coupons.retrieve(couponId);
          if (coupon.valid) {
            validatedCoupon = couponId;
          } else {
            console.warn(`stripe-checkout: coupon "${couponId}" exists but is no longer valid. Falling back to allow_promotion_codes.`);
          }
        }
      } catch (discountErr) {
        console.warn(`stripe-checkout: discount "${couponId}" could not be retrieved. Falling back to allow_promotion_codes.`, discountErr instanceof Error ? discountErr.message : String(discountErr));
      }
    }

    // Get user profile for email and plan (single fetch, used in both pack and subscription flows)
    const { data: profile } = await sb
      .from("profiles")
      .select("email, plan")
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

    // Auto-apply promo codes server-side when none sent by client.
    // Promo IDs are Stripe Promotion Code objects (promo_...) with per-customer redemption limits
    // configured in the Stripe Dashboard — so passing them always is safe: Stripe enforces the rules.
    if (!validatedPromoCode && !validatedCoupon) {
      const AUTO_PROMOS: Record<string, string> = {
        starter:       "promo_1T5Xb9DofGNcXNHKgaXOtdxQ", // 50% off Starter subscription
        growth:        "promo_1T5XZZDofGNcXNHKRrssNcdE", // 30% off Growth/Scale subscription
        scale:         "promo_1T5XZZDofGNcXNHKRrssNcdE", // 30% off Growth/Scale subscription
        single_standard: "promo_1T7tW2DofGNcXNHKHTRW79iU", // 50% off single video
        single_hd:       "promo_1T7tW2DofGNcXNHKHTRW79iU", // 50% off single video
      };
      const autoPromoId = plan ? AUTO_PROMOS[plan] : (pack ? AUTO_PROMOS[pack] : undefined);
      if (autoPromoId) {
        try {
          const promoCode = await stripe.promotionCodes.retrieve(autoPromoId);
          if (promoCode.active && promoCode.coupon?.valid) {
            validatedPromoCode = autoPromoId;
          } else {
            console.warn(`stripe-checkout: auto-promo "${autoPromoId}" is inactive or expired — falling back to allow_promotion_codes.`);
          }
        } catch (e) {
          console.warn(`stripe-checkout: could not retrieve auto-promo "${autoPromoId}" — falling back to allow_promotion_codes.`, e instanceof Error ? e.message : String(e));
        }
      }
    }

    // Auto-apply plan discount for credit pack purchases (uses profile already fetched above)
    if (pack && !validatedCoupon) {
      const userPlan = profile.plan as string | undefined;
      if (userPlan === "growth") {
        const growthCoupon = Deno.env.get("STRIPE_GROWTH_COUPON_ID");
        if (growthCoupon) validatedCoupon = growthCoupon;
      } else if (userPlan === "scale") {
        const scaleCoupon = Deno.env.get("STRIPE_SCALE_COUPON_ID");
        if (scaleCoupon) validatedCoupon = scaleCoupon;
      }
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

      const isSingleVideo = pack === "single_standard" || pack === "single_hd";
      const packSuccessUrl = (generation_id || isSingleVideo)
        ? `${FRONTEND_URL}/generate?checkout=success&pack=${pack}&session_id={CHECKOUT_SESSION_ID}`
        : `${FRONTEND_URL}/dashboard?checkout=success&pack=${pack}&session_id={CHECKOUT_SESSION_ID}`;

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: stripeCustomerId,
        mode: "payment",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: packSuccessUrl,
        cancel_url: `${FRONTEND_URL}/settings/billing?checkout=cancelled`,
        metadata: {
          supabase_user_id: userId,
          pack,
          ...(generation_id ? { generation_id } : {}),
        },
      };

      if (validatedPromoCode) {
        sessionParams.discounts = [{ promotion_code: validatedPromoCode }];
      } else if (validatedCoupon) {
        sessionParams.discounts = [{ coupon: validatedCoupon }];
      } else {
        sessionParams.allow_promotion_codes = true;
      }

      const session = await stripe.checkout.sessions.create(sessionParams);
      return json({ data: { url: session.url } }, cors);
    }

    // ── Subscription ──────────────────────────────────────────────────────────
    const resolvedPriceId = isAnnual
      ? PLAN_PRICE_IDS_ANNUAL[plan]
      : PLAN_PRICE_IDS_MONTHLY[plan];

    if (!resolvedPriceId) {
      console.error(`Stripe price ID not configured for plan: ${plan} (${billing ?? "monthly"})`);
      return json(
        { detail: "Checkout is not available right now. Please try again later." },
        cors,
        503,
      );
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      success_url: `${FRONTEND_URL}/dashboard?checkout=success&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/pricing?checkout=canceled`,
      subscription_data: {
        metadata: { supabase_user_id: userId, plan, billing: billing ?? "monthly" },
      },
      metadata: {
        supabase_user_id: userId,
        plan,
        billing: billing ?? "monthly",
      },
    };
    if (validatedPromoCode) {
      sessionParams.discounts = [{ promotion_code: validatedPromoCode }];
    } else if (validatedCoupon) {
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
