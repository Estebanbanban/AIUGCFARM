"use client";

import { useQuery } from "@tanstack/react-query";
import type { SegmentBatch, Segment } from "@/types/database";
import type { ApiResponse } from "@/types/api";

export function useGenerationProgress(batchId: string) {
  return useQuery<{ batch: SegmentBatch; segments: Segment[] }>({
    queryKey: ["generation-progress", batchId],
    queryFn: async () => {
      const res = await fetch(`/api/segments/${batchId}`);
      const json: ApiResponse<{ batch: SegmentBatch; segments: Segment[] }> =
        await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 5000;
      const allDone = data.segments.every(
        (s) => s.status === "completed" || s.status === "failed"
      );
      return allDone ? false : 5000;
    },
    enabled: !!batchId,
  });
}
