"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Brand } from "@/types/database";
import type { ApiResponse } from "@/types/api";
import type { CreateBrandInput, UpdateBrandInput } from "@/schemas/brand";

export function useBrands() {
  return useQuery<Brand[]>({
    queryKey: ["brands"],
    queryFn: async () => {
      const res = await fetch("/api/brands");
      const json: ApiResponse<Brand[]> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
  });
}

export function useBrand(id: string) {
  return useQuery<Brand>({
    queryKey: ["brands", id],
    queryFn: async () => {
      const res = await fetch(`/api/brands/${id}`);
      const json: ApiResponse<Brand> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    enabled: !!id,
  });
}

export function useCreateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateBrandInput) => {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json: ApiResponse<Brand> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brands"] }),
  });
}

export function useUpdateBrand(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateBrandInput) => {
      const res = await fetch(`/api/brands/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json: ApiResponse<Brand> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      queryClient.invalidateQueries({ queryKey: ["brands", id] });
    },
  });
}

export function useDeleteBrand(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/brands/${id}`, { method: "DELETE" });
      const json: ApiResponse<{ success: boolean }> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brands"] }),
  });
}
