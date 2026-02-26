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
    credits: 27,
    personas: 1,
    brands: 1,
    resolution: "720p",
    features: [
      "27 credits/month",
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
    credits: 90,
    personas: 3,
    brands: 3,
    resolution: "1080p",
    features: [
      "90 credits/month",
      "3 AI personas",
      "3 brand profiles",
      "Easy + Expert Mode",
      "1080p export",
      "Custom script editing",
    ],
  },
  scale: {
    name: "Scale",
    price: 149,
    priceId: process.env.STRIPE_SCALE_PRICE_ID!,
    credits: 300,
    personas: 10,
    brands: 10,
    resolution: "1080p",
    features: [
      "300 credits/month",
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
