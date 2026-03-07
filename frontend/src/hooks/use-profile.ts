"use client";

import { useQuery } from "@tanstack/react-query";
import { callEdge } from "@/lib/api";
import type { Profile } from "@/types/database";

export const BRAND_LIMITS: Record<string, number> = {
  free: 1, starter: 1, growth: 3, scale: Infinity,
};
export const PRODUCTS_PER_BRAND_LIMITS: Record<string, number> = {
  free: 3, starter: 5, growth: 20, scale: Infinity,
};
export const PERSONAS_PER_MONTH_LIMITS: Record<string, number> = {
  free: 1, starter: 2, growth: 10, scale: 100,
};

/** Plans that can use HD (Kling V3) video quality */
export const HD_QUALITY_PLANS: Set<Profile["plan"]> = new Set(["free", "starter", "growth", "scale"]);

/** Plans that can use the Advanced script editor */
export const ADVANCED_MODE_PLANS: Set<Profile["plan"]> = new Set(["free", "starter", "growth", "scale"]);

export function useProfile() {
  return useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: async () => {
      return callEdge<Profile>("get-profile", { method: "GET" });
    },
  });
}
