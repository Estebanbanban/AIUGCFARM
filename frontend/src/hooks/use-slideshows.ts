"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { callEdge } from "@/lib/api";
import type { Slideshow, SlideshowSettings, Slide } from "@/types/slideshow";

export function useSlideshows() {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery<{ slideshows: Slideshow[]; total: number }>({
    queryKey: ["slideshows"],
    queryFn: async () => {
      const res = await callEdge<{ data: { slideshows: Slideshow[]; total: number } }>(
        "list-slideshows",
        { method: "GET" }
      );
      return res.data;
    },
    enabled: isLoaded && isSignedIn === true,
    retry: false,
  });
}

export function useSlideshow(id: string | null) {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery<Slideshow>({
    queryKey: ["slideshows", id],
    queryFn: async () => {
      const res = await callEdge<{ data: Slideshow }>(`get-slideshow?id=${id}`, { method: "GET" });
      return res.data;
    },
    enabled: isLoaded && isSignedIn === true && !!id,
    retry: false,
  });
}

export function useCreateSlideshow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name?: string; product_id?: string; slides?: Slide[] }) => {
      const res = await callEdge<{ data: Slideshow }>("create-slideshow", { body: data });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["slideshows"] }),
  });
}

export function useUpdateSlideshow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string; name?: string; settings?: Partial<SlideshowSettings>; slides?: Slide[]; status?: string; hook_text?: string }) => {
      const res = await callEdge<{ data: Slideshow }>("update-slideshow", { body: data });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["slideshows"] });
      queryClient.invalidateQueries({ queryKey: ["slideshows", data.id] });
    },
  });
}

export function useDeleteSlideshow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await callEdge("delete-slideshow", { body: { id } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["slideshows"] }),
  });
}
