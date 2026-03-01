/**
 * Plan definitions for UI display.
 * Stripe checkout is handled server-side via the stripe-checkout Edge Function.
 * No Stripe SDK or secret key needed on the frontend.
 *
 * Pricing model: 1 credit = $1
 * Kling v2.6 (standard): 5cr single, 15cr triple
 * Kling v3 (hd):        10cr single, 30cr triple
 */

// ── Per-generation credit costs ───────────────────────────────────────────────

/** Standard single (v2.6): 1 hook + 1 body + 1 CTA */
export const CREDITS_PER_SINGLE = 5;
/** Standard triple (v2.6): 3 hooks + 3 bodies + 3 CTAs */
export const CREDITS_PER_BATCH = 15;
/** HD single (v3): 1 hook + 1 body + 1 CTA */
export const CREDITS_PER_SINGLE_HD = 10;
/** HD triple (v3): 3 hooks + 3 bodies + 3 CTAs */
export const CREDITS_PER_BATCH_HD = 30;

// ── Subscription plans ────────────────────────────────────────────────────────

export const PLANS = {
  starter: {
    name: "Starter",
    price: 25,
    credits: 30,
    personas: 1,
    brands: 1,
    resolution: "720p",
    features: [
      "30 credits/month ($30 value)",
      "6 Kling 2.6 or 3 Kling 3.0 videos",
      "1 AI persona",
      "1 brand profile",
      "AI-Written Scripts",
      "720p MP4 export",
    ],
  },
  growth: {
    name: "Growth",
    price: 80,
    credits: 100,
    personas: 3,
    brands: 3,
    resolution: "1080p",
    features: [
      "100 credits/month ($100 value)",
      "20 Kling 2.6 or 10 Kling 3.0 videos",
      "3 AI personas",
      "3 brand profiles",
      "AI-Written Scripts + Custom Script Editor",
      "1080p MP4 export",
      "Priority generation",
    ],
  },
  scale: {
    name: "Scale",
    price: 180,
    credits: 250,
    personas: 10,
    brands: 10,
    resolution: "1080p",
    features: [
      "250 credits/month ($250 value)",
      "50 Kling 2.6 or 25 Kling 3.0 videos",
      "10 AI personas",
      "10 brand profiles",
      "AI-Written Scripts + Custom Script Editor",
      "1080p MP4 export",
      "Priority support",
    ],
  },
} as const;

export type PlanTier = keyof typeof PLANS;

// ── One-time credit packs ─────────────────────────────────────────────────────
// Packs cost MORE per credit than subscriptions to incentivize subscribing.
// Subscription rate: $0.83/cr (Starter). Pack rates: $1.20 → $1.10 → $0.95/cr.

export const CREDIT_PACKS = {
  pack_10: {
    name: "Starter Pack",
    credits: 10,
    price: 12,
    pricePerCredit: 1.2,
    description: "2 Kling 2.6 or 1 Kling 3.0 video",
  },
  pack_30: {
    name: "Creator Pack",
    credits: 30,
    price: 33,
    pricePerCredit: 1.1,
    description: "6 Kling 2.6 or 3 Kling 3.0 videos",
  },
  pack_100: {
    name: "Pro Pack",
    credits: 100,
    price: 95,
    pricePerCredit: 0.95,
    description: "20 Kling 2.6 or 10 Kling 3.0 videos",
    badge: "Best value",
  },
} as const;

export type CreditPackKey = keyof typeof CREDIT_PACKS;

// ── Single-video purchases (paywall "Try 1 Video" tab) ────────────────────────
// These are standalone Stripe prices for a single video generation.
// Standard = 5 credits ($5), HD = 10 credits ($10).

export const SINGLE_VIDEO_PACKS = {
  single_standard: {
    name: "Single Video · Standard",
    credits: CREDITS_PER_SINGLE,       // 5
    price: CREDITS_PER_SINGLE,         // $5
    quality: "standard" as const,
  },
  single_hd: {
    name: "Single Video · HD",
    credits: CREDITS_PER_SINGLE_HD,    // 10
    price: CREDITS_PER_SINGLE_HD,      // $10
    quality: "hd" as const,
  },
} as const;

export type SingleVideoPackKey = keyof typeof SINGLE_VIDEO_PACKS;
