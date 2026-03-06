"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
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
      const supabase = createClient();
      const { data, error } = await supabase
        .from("brands")
        .select("*, products(count)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data as Record<string, unknown>[]).map((b) => ({
        ...b,
        product_count:
          Array.isArray(b.products) && b.products.length > 0
            ? (b.products as { count: number }[])[0].count
            : 0,
      })) as Brand[];
    },
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
