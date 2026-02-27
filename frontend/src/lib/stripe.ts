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
    price: 149,
    credits: 300,
    personas: 10,
    brands: 10,
    resolution: "1080p",
    features: [
      "300 segment credits/month",
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

/** Cost per batch generation in segment credits */
export const CREDITS_PER_BATCH = 9;
