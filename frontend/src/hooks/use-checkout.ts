"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { callEdge } from "@/lib/api";
import type { PlanTier } from "@/lib/stripe";

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

export function useBillingPortal() {
  return useMutation({
    mutationFn: async () => {
      const res = await callEdge<{ data: { url: string } }>("stripe-portal", {});
      return res.data.url;
    },
  });
}
