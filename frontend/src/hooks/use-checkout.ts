"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { callEdge } from "@/lib/api";
import type { PlanTier, CreditPackKey, SingleVideoPackKey } from "@/lib/stripe";

interface CheckoutResponse {
  data: { url: string };
}

interface CheckoutPlanArgs {
  plan: PlanTier;
  billing?: "monthly" | "annual";
  couponId?: string;
}

interface CheckoutPackArgs {
  pack: CreditPackKey | SingleVideoPackKey;
  couponId?: string;
  generation_id?: string;
}

export function useCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ plan, billing, couponId }: CheckoutPlanArgs) => {
      const res = await callEdge<CheckoutResponse>("stripe-checkout", {
        body: { plan, ...(billing ? { billing } : {}), ...(couponId ? { couponId } : {}) },
      });
      return res.data.url;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

/** One-time credit pack purchase. Redirects to Stripe Checkout. */
export function useBuyCredits() {
  return useMutation({
    mutationFn: async ({ pack, couponId, generation_id }: CheckoutPackArgs) => {
      const res = await callEdge<CheckoutResponse>("stripe-checkout", {
        body: {
          pack,
          ...(couponId ? { couponId } : {}),
          ...(generation_id ? { generation_id } : {}),
        },
      });
      return res.data.url;
    },
  });
}

export function useBillingPortal() {
  return useMutation({
    mutationFn: async () => {
      const res = await callEdge<{ data: { url: string } }>("stripe-portal", {});
      return res.data.url;
    },
  });
}
