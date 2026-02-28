"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

export const PERSONA_SLOT_LIMITS: Record<Profile["plan"], number> = {
  free: 0,
  starter: 1,
  growth: 3,
  scale: 10,
};

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
