"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { callEdge } from "@/lib/api";
import type { Product } from "@/types/database";
import type { ScrapeResponse, ConfirmProductsResponse } from "@/types/api";

export function useProducts() {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await callEdge<{ data: Product[] }>("list-products", { method: "GET" });
      return res.data;
    },
    enabled: isLoaded && isSignedIn === true,
    retry: false,
  });
}

export function useProduct(id: string) {
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  return useQuery<Product>({
    queryKey: ["products", id],
    queryFn: async () => {
      const res = await callEdge<{ data: Product[] }>("list-products", { method: "GET" });
      const product = res.data.find((p) => p.id === id);
      if (!product) throw new Error("Product not found");
      return product;
    },
    enabled: isLoaded && isSignedIn === true && !!id,
    retry: false,
    initialData: () => {
      const products = queryClient.getQueryData<Product[]>(["products"]);
      return products?.find((p) => p.id === id);
    },
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(["products"])?.dataUpdatedAt,
  });
}

export function useUpdateProduct(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Product>) => {
      const res = await callEdge<{ data: Product }>("update-product", {
        body: { id, ...data },
      });
      return res.data;
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
      await callEdge("delete-product", { body: { id } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useScrapeProduct() {
  return useMutation({
    mutationFn: async (data: { url: string }) => {
      const res = await callEdge<ScrapeResponse>("scrape-product", { body: data });
      return res.data;
    },
    // No invalidation here: scraping returns candidates only, it does NOT
    // write confirmed products to the DB. Only confirm-products does that.
    // Invalidating here was causing the onboarding modal to close mid-flow.
  });
}

export function useProductsByBrand(brandId: string | null) {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery<Product[]>({
    queryKey: ["products", "brand", brandId],
    queryFn: async () => {
      if (!brandId) return [];
      const res = await callEdge<{ data: Product[] }>(
        `list-products?brand_id=${brandId}`,
        { method: "GET" }
      );
      return res.data;
    },
    enabled: isLoaded && isSignedIn === true && !!brandId,
    retry: false,
  });
}

export function useConfirmProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { product_ids: string[]; brand_id?: string }) => {
      const res = await callEdge<ConfirmProductsResponse>("confirm-products", { body: data });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}
