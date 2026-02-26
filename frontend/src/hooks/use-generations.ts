"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { callEdge } from "@/lib/api";
import type { Generation } from "@/types/database";
import type { CreateGenerationInput } from "@/schemas/generation";

export function useGenerations() {
  return useQuery<Generation[]>({
    queryKey: ["generations"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("generations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
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

export function useCreateGeneration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateGenerationInput) => {
      return callEdge<Generation>("generate-video", { body: data });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["generations"] }),
  });
}
