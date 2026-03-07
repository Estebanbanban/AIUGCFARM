"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { callEdge } from "@/lib/api";
import type { Generation } from "@/types/database";
import type {
  CompositeImagesResponse,
  CreateGenerationResponse,
  ApproveGenerationParams,
  EditCompositeImageResponse,
  GenerationProgressResponse,
  GenerationHistoryResponse,
  RegenerateSegmentResponse,
  AdvancedSegmentsInput,
  GenerateSegmentScriptResponse,
  GenerateSegmentCompositeResponse,
} from "@/types/api";

interface GenerationInput {
  product_id: string;
  persona_id: string;
  mode: "single" | "triple";
  quality: "standard" | "hd";
  composite_image_path: string;
  cta_style?:
    | "auto"
    | "product_name_drop"
    | "link_in_bio"
    | "link_in_comments"
    | "comment_keyword"
    | "check_description"
    | "direct_website"
    | "discount_code";
  cta_comment_keyword?: string;
  language?: string;
  advanced_segments?: AdvancedSegmentsInput;
  hooks_count?: number;
  bodies_count?: number;
  ctas_count?: number;
}

export interface GenerationWithRelations extends Generation {
  products: { name: string; images: string[] } | null;
  personas: { name: string; selected_image_url: string | null } | null;
}

export function useGenerations() {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery<GenerationWithRelations[]>({
    queryKey: ["generations"],
    queryFn: async () => {
      const res = await callEdge<{ data: GenerationWithRelations[] }>(
        "list-generations",
        { method: "GET" }
      );
      return res.data;
    },
    enabled: isLoaded && isSignedIn === true,
    retry: false,
  });
}

export function useGeneration(id: string) {
  const queryClient = useQueryClient();
  return useQuery<Generation>({
    queryKey: ["generations", id],
    queryFn: async () => {
      const res = await callEdge<{ data: GenerationWithRelations[] }>(
        "list-generations",
        { method: "GET" }
      );
      const gen = res.data.find((g) => g.id === id);
      if (!gen) throw new Error("Generation not found");
      return gen as Generation;
    },
    enabled: !!id,
    retry: false,
    initialData: () => {
      const gens = queryClient.getQueryData<GenerationWithRelations[]>(["generations"]);
      return gens?.find((g) => g.id === id) as Generation | undefined;
    },
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(["generations"])?.dataUpdatedAt,
  });
}

/** Generate composite preview images (persona + product) before spending credits. */
export function useGenerateCompositeImages() {
  return useMutation({
    mutationFn: async (input: {
      product_id: string;
      persona_id: string;
      format: "9:16" | "16:9";
      selected_images?: string[];
    }) => {
      const res = await callEdge<CompositeImagesResponse>("generate-composite-images", {
        body: input,
      });
      return res.data;
    },
  });
}

/** Edit one selected composite preview image using text instructions. */
export function useEditCompositeImage() {
  return useMutation({
    mutationFn: async (input: {
      composite_image_path: string;
      edit_prompt: string;
      format: "9:16" | "16:9";
    }) => {
      const res = await callEdge<EditCompositeImageResponse>("edit-composite-image", {
        body: input,
      });
      return res.data;
    },
  });
}

/** Generate script only (phase: "script") - no credits charged. */
export function useGenerateScript() {
  return useMutation({
    mutationFn: async (input: GenerationInput & { phase: "script" }) => {
      const res = await callEdge<CreateGenerationResponse>("generate-video", {
        body: input,
      });
      return res.data;
    },
  });
}

/** Approve a pending script and kick off full video generation. */
export function useApproveAndGenerate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ApproveGenerationParams) => {
      const res = await callEdge<CreateGenerationResponse>("generate-video", {
        body: { ...input, phase: "full" },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["generations"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
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
      // Refresh credits even on error - debit may have been attempted then refunded
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
  });
}

/** Regenerate a single segment (hook/body/cta variation) for 1 credit. */
export function useRegenerateSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      generation_id: string;
      segment_type: "hook" | "body" | "cta";
      variation: number;
    }) => {
      const res = await callEdge<RegenerateSegmentResponse>("regenerate-segment", {
        body: input,
      });
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({
        queryKey: ["generation-progress", variables.generation_id],
      });
      queryClient.invalidateQueries({ queryKey: ["generations"] });
    },
  });
}

/** Poll generation status (auto-refetches while processing). */
export function useGenerationStatus(generationId: string | null, stopPolling = false) {
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
      if (stopPolling) return false;
      const data = query.state.data;
      if (
        data?.status === "completed" ||
        data?.status === "failed" ||
        data?.status === "awaiting_approval"
      ) {
        return false;
      }
      return 5000;
    },
  });
}

/** Generate a single segment script for Advanced Mode. */
export function useGenerateSegmentScript() {
  return useMutation({
    mutationFn: async (input: {
      product_id: string;
      persona_id: string;
      segment_type: "hook" | "body" | "cta";
      variant_index: number;
      cta_style?: string;
      cta_comment_keyword?: string;
    }) => {
      const res = await callEdge<GenerateSegmentScriptResponse>("generate-segment-script", {
        body: input,
      });
      return res.data;
    },
  });
}

/** Generate a single composite image for a segment in Advanced Mode. */
export function useGenerateSegmentComposite() {
  return useMutation({
    mutationFn: async (input: {
      product_id: string;
      persona_id: string;
      format: "9:16" | "16:9";
      custom_scene_prompt?: string;
    }) => {
      const res = await callEdge<GenerateSegmentCompositeResponse>("generate-segment-composite", {
        body: input,
      });
      return res.data;
    },
  });
}

/** Fetch the number of segment regenerations used this calendar month. */
export function useRegenLimit() {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["regen-limit"],
    queryFn: async () => {
      const month = new Date().toISOString().slice(0, 7);
      const res = await callEdge<{ data: { regens_used: number } | null }>(
        `get-regen-limit?month=${month}`,
        { method: "GET" }
      );
      return res.data?.regens_used ?? 0;
    },
    enabled: isLoaded && isSignedIn === true,
    staleTime: 30_000,
    retry: false,
  });
}

/** Delete a generation record owned by the current user. */
export function useDeleteGeneration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (generationId: string) => {
      await callEdge("delete-generation", { body: { id: generationId } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generation-history"] });
      queryClient.invalidateQueries({ queryKey: ["generations"] });
    },
  });
}

/** Fetch paginated generation history from the Edge Function. */
export function useGenerationHistory(page = 1) {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["generation-history", page],
    queryFn: async () => {
      const res = await callEdge<GenerationHistoryResponse>(
        `generation-history?page=${page}&limit=20`,
        { method: "GET" }
      );
      return res.data;
    },
    enabled: isLoaded && isSignedIn === true,
  });
}
