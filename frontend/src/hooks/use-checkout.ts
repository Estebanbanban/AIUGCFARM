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
  return_path?: string;
}

interface CheckoutPackArgs {
  pack: CreditPackKey | SingleVideoPackKey;
  couponId?: string;
  generation_id?: string;
  return_path?: string;
}

export function useCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ plan, billing, couponId, return_path }: CheckoutPlanArgs) => {
      const res = await callEdge<CheckoutResponse>("stripe-checkout", {
        body: { plan, ...(billing ? { billing } : {}), ...(couponId ? { couponId } : {}), ...(return_path ? { return_path } : {}) },
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
    mutationFn: async ({ pack, couponId, generation_id, return_path }: CheckoutPackArgs) => {
      const res = await callEdge<CheckoutResponse>("stripe-checkout", {
        body: {
          pack,
          ...(couponId ? { couponId } : {}),
          ...(generation_id ? { generation_id } : {}),
          ...(return_path ? { return_path } : {}),
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
