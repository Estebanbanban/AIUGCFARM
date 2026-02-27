"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { callEdge } from "@/lib/api";
import type { Generation } from "@/types/database";
import type {
  CreateGenerationResponse,
  GenerationProgressResponse,
  GenerationHistoryResponse,
} from "@/types/api";

interface GenerationInput {
  product_id: string;
  persona_id: string;
  mode: "single" | "triple";
  quality: "standard" | "hd";
}

export interface GenerationWithRelations extends Generation {
  products: { name: string; images: string[] } | null;
  personas: { name: string; selected_image_url: string | null } | null;
}

export function useGenerations() {
  return useQuery<GenerationWithRelations[]>({
    queryKey: ["generations"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("generations")
        .select("*, products(name, images), personas(name, selected_image_url)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data as GenerationWithRelations[];
    },
  });
}

export function useGeneration(id: string) {
  return useQuery<Generation>({
    queryKey: ["generations", id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("generations")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!id,
  });
}

/** Create a new generation (calls generate-video Edge Function). */
export function useCreateGeneration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: GenerationInput) => {
      const res = await callEdge<CreateGenerationResponse>("generate-video", {
        body: input,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["generations"] });
    },
    onError: () => {
      // Refresh credits even on error — debit may have been attempted then refunded
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
  });
}

/** Poll generation status (auto-refetches while processing). */
export function useGenerationStatus(generationId: string | null) {
  return useQuery({
    queryKey: ["generation-progress", generationId],
    queryFn: async () => {
      const res = await callEdge<GenerationProgressResponse>(
        `video-status?generation_id=${generationId}`,
        { method: "GET" }
      );
      return res.data;
    },
    enabled: !!generationId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (
        data?.status === "completed" ||
        data?.status === "failed"
      ) {
        return false;
      }
      return 5000;
    },
  });
}

/** Fetch paginated generation history from the Edge Function. */
export function useGenerationHistory(page = 1) {
  return useQuery({
    queryKey: ["generation-history", page],
    queryFn: async () => {
      const res = await callEdge<GenerationHistoryResponse>(
        `generation-history?page=${page}&limit=20`,
        { method: "GET" }
      );
      return res.data;
    },
  });
}
