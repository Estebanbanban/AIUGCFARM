"use client";

import { useQuery } from "@tanstack/react-query";
import { callEdge } from "@/lib/api";
import type { CreditBalance } from "@/types/database";

export function useCredits() {
  return useQuery<CreditBalance>({
    queryKey: ["credits"],
    queryFn: async () => {
      return callEdge<CreditBalance>("credit-balance", { method: "GET" });
    },
  });
}
