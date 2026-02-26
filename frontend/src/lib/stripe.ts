import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
  typescript: true,
});

export const PLANS = {
  starter: {
    name: "Starter",
    price: 29,
    priceId: process.env.STRIPE_STARTER_PRICE_ID!,
    segmentCredits: 27,
    personaSlots: 1,
    brandProfiles: 1,
    resolution: "720p",
    features: [
      "27 segment credits/month",
      "1 AI persona",
      "1 brand profile",
      "Easy Mode generation",
      "720p export",
    ],
  },
  growth: {
    name: "Growth",
    price: 79,
    priceId: process.env.STRIPE_GROWTH_PRICE_ID!,
    segmentCredits: 90,
    personaSlots: 3,
    brandProfiles: 3,
    resolution: "1080p",
    features: [
      "90 segment credits/month",
      "3 AI personas",
      "3 brand profiles",
      "Easy + Expert Mode",
      "1080p export",
      "Custom script editing",
    ],
  },
} as const;

export type PlanTier = keyof typeof PLANS;
