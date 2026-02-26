"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SegmentBatch, Segment, VideoCombo } from "@/types/database";
import type { ApiResponse } from "@/types/api";
import type {
  CreateSegmentBatchInput,
  CreateComboInput,
} from "@/schemas/generation";

export function useSegmentBatches() {
  return useQuery<SegmentBatch[]>({
    queryKey: ["segment-batches"],
    queryFn: async () => {
      const res = await fetch("/api/segments");
      const json: ApiResponse<SegmentBatch[]> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
  });
}

export function useSegmentBatch(batchId: string) {
  return useQuery<{ batch: SegmentBatch; segments: Segment[] }>({
    queryKey: ["segment-batches", batchId],
    queryFn: async () => {
      const res = await fetch(`/api/segments/${batchId}`);
      const json: ApiResponse<{ batch: SegmentBatch; segments: Segment[] }> =
        await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    enabled: !!batchId,
  });
}

export function useCreateSegmentBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateSegmentBatchInput) => {
      const res = await fetch("/api/segments/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json: ApiResponse<SegmentBatch> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["segment-batches"] }),
  });
}

export function useCreateCombo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateComboInput) => {
      const res = await fetch("/api/combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json: ApiResponse<VideoCombo> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["combos"] }),
  });
}

export function useCombo(comboId: string) {
  return useQuery<VideoCombo>({
    queryKey: ["combos", comboId],
    queryFn: async () => {
      const res = await fetch(`/api/combos/${comboId}`);
      const json: ApiResponse<VideoCombo> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    enabled: !!comboId,
  });
}
