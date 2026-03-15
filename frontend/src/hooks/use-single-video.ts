"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { callEdge, callEdgeMultipart } from "@/lib/api";
import type {
  SingleVideoScriptResponse,
  SingleVideoSubmitResponse,
  SingleVideoStatusResponse,
  UploadReferenceImageResponse,
} from "@/types/api";

/** Generate a structured script for the single video (phase: "script"). */
export function useGenerateSingleVideoScript() {
  return useMutation({
    mutationFn: async (input: {
      script_format: "structured" | "freeform";
      product_id?: string;
      persona_id?: string;
      is_saas?: boolean;
      language?: string;
      freeform_prompt?: string;
      structured_script?: { hook: string; body: string; cta: string };
    }) => {
      const res = await callEdge<SingleVideoScriptResponse>("generate-single-video", {
        body: { ...input, phase: "script" },
      });
      return res.data;
    },
  });
}

/** Submit the approved single video for generation (phase: "full"). */
export function useSubmitSingleVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      generation_id: string;
      sora_model: "sora-2" | "sora-2-pro";
      duration: 4 | 8 | 12 | 16 | 20;
      reference_type: "composite" | "persona" | "custom" | "none";
      reference_image_path?: string;
      composite_image_path?: string;
    }) => {
      const res = await callEdge<SingleVideoSubmitResponse>("generate-single-video", {
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

/** Poll single video generation status (auto-refetches while processing). */
export function useSingleVideoStatus(generationId: string | null) {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["single-video-status", generationId],
    queryFn: async () => {
      const res = await callEdge<SingleVideoStatusResponse>(
        `single-video-status?generation_id=${generationId}`,
        { method: "GET" }
      );
      return res.data;
    },
    enabled: isLoaded && isSignedIn === true && !!generationId,
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

/** Upload a custom reference image. */
export function useUploadReferenceImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      const res = await callEdgeMultipart<UploadReferenceImageResponse>(
        "upload-reference-image",
        formData,
      );
      return res.data;
    },
  });
}
