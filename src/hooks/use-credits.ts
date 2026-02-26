"use client";

import { useQuery } from "@tanstack/react-query";
import type { Subscription } from "@/types/database";
import type { ApiResponse } from "@/types/api";

export function useSubscription() {
  return useQuery<Subscription>({
    queryKey: ["subscription"],
    queryFn: async () => {
      const res = await fetch("/api/billing/subscription");
      const json: ApiResponse<Subscription> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
  });
}
