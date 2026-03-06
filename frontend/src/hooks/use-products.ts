"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { callEdge } from "@/lib/api";
import type { Product } from "@/types/database";
import type { ScrapeResponse, ScrapeResponseData, ConfirmProductsResponse } from "@/types/api";
import type { CreateProductInput, UpdateProductInput } from "@/schemas/product";

export function useProducts() {
  return useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("confirmed", true)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function useProduct(id: string) {
  return useQuery<Product>({
    queryKey: ["products", id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateProductInput) => {
      const supabase = createClient();
      const { data: product, error } = await supabase
        .from("products")
        .insert(data)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return product as Product;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUpdateProduct(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateProductInput) => {
      const supabase = createClient();
      const { data: product, error } = await supabase
        .from("products")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return product as Product;
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
      const supabase = createClient();
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useScrapeProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { url: string }) => {
      const res = await callEdge<ScrapeResponse>("scrape-product", { body: data });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useProductsByBrand(brandId: string | null) {
  return useQuery<Product[]>({
    queryKey: ["products", "brand", brandId],
    queryFn: async () => {
      if (!brandId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("brand_id", brandId)
        .eq("confirmed", true)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!brandId,
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
