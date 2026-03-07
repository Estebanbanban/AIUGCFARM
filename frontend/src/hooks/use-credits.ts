"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { callEdge } from "@/lib/api";

interface CreditInfo {
  remaining: number;
  plan: string;
  is_unlimited?: boolean;
}

interface CreditBalanceResponse {
  data: CreditInfo;
}

export function useCredits() {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery<CreditInfo>({
    queryKey: ["credits"],
    queryFn: async () => {
      const res = await callEdge<CreditBalanceResponse>("credit-balance", {
        method: "GET",
      });
      return res.data;
    },
    enabled: isLoaded && isSignedIn === true,
  });
}
