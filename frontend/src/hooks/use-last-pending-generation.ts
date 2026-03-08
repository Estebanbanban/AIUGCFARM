"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { createClient } from "@/lib/supabase/client";
import type { GenerationScript } from "@/types/database";

export interface LastPendingGeneration {
  id: string;
  product_id: string;
  persona_id: string;
  mode: "single" | "triple";
  video_quality: "standard" | "hd";
  script: GenerationScript | null;
  credits_to_charge: number | null;
  format: string | null;
  cta_style: string | null;
  language: string | null;
  video_provider: string | null;
}

/**
 * Fetches the most recent `awaiting_approval` generation for the current user.
 *
 * Used to auto-restore wizard state when localStorage has been cleared
 * (e.g. Stripe redirect on mobile, browser cache clear, new device).
 */
export function useLastPendingGeneration() {
  const { isLoaded, isSignedIn } = useAuth();

  return useQuery<LastPendingGeneration | null>({
    queryKey: ["last-pending-generation"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("generations")
        .select(
          "id, product_id, persona_id, mode, video_quality, script, credits_to_charge, format, cta_style, language, video_provider",
        )
        .eq("status", "awaiting_approval")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as LastPendingGeneration | null;
    },
    enabled: isLoaded && isSignedIn === true,
    staleTime: 30_000, // 30 seconds — check frequently
    gcTime: 60_000,
  });
}
