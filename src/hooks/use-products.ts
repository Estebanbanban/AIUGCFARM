"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Product } from "@/types/database";
import type { ApiResponse } from "@/types/api";
import type { CreateProductInput, UpdateProductInput } from "@/schemas/product";

export function useProducts(brandId?: string) {
  return useQuery<Product[]>({
    queryKey: ["products", { brandId }],
    queryFn: async () => {
      const params = brandId ? `?brandId=${brandId}` : "";
      const res = await fetch(`/api/products${params}`);
      const json: ApiResponse<Product[]> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
  });
}

export function useProduct(id: string) {
  return useQuery<Product>({
    queryKey: ["products", id],
    queryFn: async () => {
      const res = await fetch(`/api/products/${id}`);
      const json: ApiResponse<Product> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateProductInput) => {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json: ApiResponse<Product> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (data) {
        queryClient.invalidateQueries({
          queryKey: ["products", { brandId: data.brand_id }],
        });
      }
    },
  });
}

export function useUpdateProduct(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateProductInput) => {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json: ApiResponse<Product> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products", id] });
    },
  });
}

export function useDeleteProduct(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const json: ApiResponse<{ success: boolean }> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
