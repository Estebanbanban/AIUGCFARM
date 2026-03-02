"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

export const PERSONA_SLOT_LIMITS: Record<Profile["plan"], number> = {
  free: 1,
  starter: 1,
  growth: 3,
  scale: 10,
};

export const PRODUCT_SLOT_LIMITS: Record<Profile["plan"], number> = {
  free: 3,
  starter: 5,
  growth: 5,
  scale: 10,
};

/** Plans that can use HD (Kling V3) video quality */
export const HD_QUALITY_PLANS: Set<Profile["plan"]> = new Set(["free", "starter", "growth", "scale"]);

/** Plans that can use the Advanced script editor */
export const ADVANCED_MODE_PLANS: Set<Profile["plan"]> = new Set(["free", "starter", "growth", "scale"]);

export function useProfile() {
  return useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as Profile;
    },
  });
}
