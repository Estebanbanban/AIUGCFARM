"use client";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * Fetches the last-saved composite preview paths from the server for a given
 * product + persona + format combination.
 *
 * Used as a persistent fallback when the localStorage cache is empty (e.g. after
 * a Stripe redirect, browser restart, or localStorage clear).
 */
export function useCompositeCache(
  productId: string | null,
  personaId: string | null,
  format: string | null,
) {
  return useQuery({
    queryKey: ["composite-cache", productId, personaId, format],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("composite_cache")
        .select("paths, updated_at")
        .eq("product_id", productId!)
        .eq("persona_id", personaId!)
        .eq("format", format!)
        .maybeSingle();
      if (error) throw error;
      return data as { paths: string[]; updated_at: string } | null;
    },
    enabled: !!productId && !!personaId && !!format,
    staleTime: 5 * 60 * 1000, // 5 min — re-fetch after 5 min if user lingers
    gcTime: 10 * 60 * 1000,
  });
}
