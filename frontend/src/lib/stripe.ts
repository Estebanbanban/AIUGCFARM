/**
 * Plan definitions for UI display.
 * Stripe checkout is handled server-side via the stripe-checkout Edge Function.
 * No Stripe SDK or secret key needed on the frontend.
 */
export const PLANS = {
  starter: {
    name: "Starter",
    price: 29,
    credits: 27,
    personas: 1,
    brands: 1,
    resolution: "720p",
    features: [
      "27 segment credits/month (3 batches)",
      "1 AI persona",
      "1 brand profile",
      "Easy Mode generation",
      "720p export",
    ],
  },
  growth: {
    name: "Growth",
    price: 79,
    credits: 90,
    personas: 3,
    brands: 3,
    resolution: "720p",
    features: [
      "90 segment credits/month (10 batches)",
      "3 AI personas",
      "3 brand profiles",
      "Easy + Expert Mode",
      "720p export",
      "Custom script editing",
    ],
  },
  scale: {
    name: "Scale",
    price: 199,
    credits: 270,
    personas: 10,
    brands: 10,
    resolution: "1080p",
    features: [
      "270 segment credits/month",
      "10 AI personas",
      "10 brand profiles",
      "Easy + Expert Mode",
      "1080p export",
      "Custom script editing",
      "Priority support",
    ],
  },
} as const;

export type PlanTier = keyof typeof PLANS;

/** Cost per single generation (1 hook + 1 body + 1 CTA) — kling-v2-6 std */
export const CREDITS_PER_SINGLE = 3;
/** Cost per triple generation (3 hooks + 3 bodies + 3 CTAs) — kling-v2-6 std */
export const CREDITS_PER_BATCH = 9;
/** Cost per single generation — kling-v3 std (2× v2-6) */
export const CREDITS_PER_SINGLE_HD = 6;
/** Cost per triple generation — kling-v3 std (2× v2-6) */
export const CREDITS_PER_BATCH_HD = 18;
