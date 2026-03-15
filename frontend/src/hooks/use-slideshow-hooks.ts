"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { callEdge } from "@/lib/api";
import type { SlideshowHook } from "@/types/slideshow";

export function useSlideshowHooks(productId?: string) {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery<SlideshowHook[]>({
    queryKey: ["slideshow-hooks", productId],
    queryFn: async () => {
      const params = productId ? `?product_id=${productId}` : "";
      const res = await callEdge<{ data: { hooks: SlideshowHook[] } }>(
        `list-slideshow-hooks${params}`,
        { method: "GET" }
      );
      return res.data.hooks;
    },
    enabled: isLoaded && isSignedIn === true,
    retry: false,
  });
}

export function useGenerateHooks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { product_id?: string; niche?: string; count?: number }) => {
      const res = await callEdge<{ data: { hooks: SlideshowHook[] } }>(
        "generate-slideshow-hooks",
        { body: data }
      );
      return res.data.hooks;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["slideshow-hooks"] }),
  });
}

export function useDeleteHook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await callEdge("delete-slideshow-hook", { body: { id } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["slideshow-hooks"] }),
  });
}
