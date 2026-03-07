"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { callEdge } from "@/lib/api";
import type { Subscription, CreditLedgerEntry } from "@/types/database";

export function useSubscription() {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery<Subscription | null>({
    queryKey: ["subscription"],
    queryFn: async () => {
      const res = await callEdge<{ data: Subscription | null }>("get-subscription", {
        method: "GET",
      });
      return res.data;
    },
    enabled: isLoaded && isSignedIn === true,
    retry: false,
  });
}

export function useCreditLedger() {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery<CreditLedgerEntry[]>({
    queryKey: ["credit-ledger"],
    queryFn: async () => {
      const res = await callEdge<{ data: CreditLedgerEntry[] }>("get-credit-ledger", {
        method: "GET",
      });
      return res.data;
    },
    enabled: isLoaded && isSignedIn === true,
    retry: false,
  });
}
