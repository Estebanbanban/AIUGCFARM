"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { callEdge } from "@/lib/api";
import type { Generation } from "@/types/database";

export function useGenerationProgress(generationId: string) {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery<Generation>({
    queryKey: ["generation-progress", generationId],
    queryFn: async () => {
      return callEdge<Generation>(
        `video-status?generation_id=${generationId}`,
        { method: "GET" }
      );
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 5000;
      const done =
        data.status === "completed" || data.status === "failed";
      return done ? false : 5000;
    },
    enabled: isLoaded && isSignedIn === true && !!generationId,
  });
}
