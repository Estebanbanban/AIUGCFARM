"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { callEdge } from "@/lib/api";

export interface Brand {
  id: string;
  owner_id: string;
  name: string;
  store_url: string | null;
  visual_identity: Record<string, unknown>;
  messaging: Record<string, unknown>;
  brand_type: string | null;
  created_at: string;
  updated_at: string;
  product_count?: number;
}

export function useBrands() {
  return useQuery<Brand[]>({
    queryKey: ["brands"],
    queryFn: async () => {
      const res = await callEdge<{ data: Brand[] }>("list-brands", { method: "GET" });
      return res.data;
    },
    retry: false,
  });
}

export function useCreateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; store_url?: string }) => {
      const res = await callEdge<{ data: Brand }>("create-brand", { body: data });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brands"] }),
  });
}

export function useUpdateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      brand_id: string;
      name?: string;
      visual_identity?: Record<string, unknown>;
      messaging?: Record<string, unknown>;
      brand_type?: string;
    }) => {
      const res = await callEdge<{ data: Brand }>("update-brand", { body: data });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brands"] }),
  });
}

export function useDeleteBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (brandId: string) => {
      await callEdge("delete-brand", { body: { brand_id: brandId } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
