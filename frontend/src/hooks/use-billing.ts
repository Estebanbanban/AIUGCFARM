"use client";

import { useQuery } from "@tanstack/react-query";
import { callEdge } from "@/lib/api";
import type { Subscription, CreditLedgerEntry } from "@/types/database";

export function useSubscription() {
  return useQuery<Subscription | null>({
    queryKey: ["subscription"],
    queryFn: async () => {
      const res = await callEdge<{ data: Subscription | null }>("get-subscription", {
        method: "GET",
      });
      return res.data;
    },
    retry: false,
  });
}

export function useCreditLedger() {
  return useQuery<CreditLedgerEntry[]>({
    queryKey: ["credit-ledger"],
    queryFn: async () => {
      const res = await callEdge<{ data: CreditLedgerEntry[] }>("get-credit-ledger", {
        method: "GET",
      });
      return res.data;
    },
    retry: false,
  });
}
