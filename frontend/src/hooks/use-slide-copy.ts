"use client";

import { useMutation } from "@tanstack/react-query";
import { callEdge } from "@/lib/api";
import type { GeneratedSlideCopy } from "@/types/slideshow";

export function useGenerateSlideCopy() {
  return useMutation({
    mutationFn: async (data: { hook_text: string; product_id?: string; slide_count?: number; soft_cta?: string; copy_length?: "short" | "long"; carousel_style?: string }) => {
      const res = await callEdge<{ data: { slides: GeneratedSlideCopy[] } }>(
        "generate-slide-copy",
        { body: data }
      );
      return res.data.slides;
    },
  });
}
