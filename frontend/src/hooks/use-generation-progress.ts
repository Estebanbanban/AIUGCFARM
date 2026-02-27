"use client";

import { useQuery } from "@tanstack/react-query";
import { callEdge } from "@/lib/api";
import type { GenerationProgressResponse } from "@/types/api";

export function useGenerationProgress(generationId: string) {
  return useQuery({
    queryKey: ["generation-progress", generationId],
    queryFn: async () => {
      const res = await callEdge<GenerationProgressResponse>(
        `video-status?generation_id=${generationId}`,
        { method: "GET" }
      );
      return res.data;
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 5000;
      const done =
        data.status === "completed" || data.status === "failed";
      return done ? false : 5000;
    },
    enabled: !!generationId,
  });
}
