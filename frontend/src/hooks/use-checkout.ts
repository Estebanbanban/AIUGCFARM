"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { callEdge } from "@/lib/api";
import type { PlanTier, CreditPackKey } from "@/lib/stripe";

interface CheckoutResponse {
  data: { url: string };
}

export function useCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (plan: PlanTier) => {
      const res = await callEdge<CheckoutResponse>("stripe-checkout", {
        body: { plan },
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
    mutationFn: async (pack: CreditPackKey) => {
      const res = await callEdge<CheckoutResponse>("stripe-checkout", {
        body: { pack },
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
