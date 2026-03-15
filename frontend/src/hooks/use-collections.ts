"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { callEdge, callEdgeMultipart } from "@/lib/api";
import type { ImageCollection, CollectionImage } from "@/types/slideshow";

export function useCollections() {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery<ImageCollection[]>({
    queryKey: ["collections"],
    queryFn: async () => {
      const res = await callEdge<{ data: ImageCollection[] }>("list-image-collections", { method: "GET" });
      return res.data;
    },
    enabled: isLoaded && isSignedIn === true,
    retry: 2,
    retryDelay: 1000,
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await callEdge<{ data: ImageCollection }>("create-image-collection", { body: data });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["collections"] }),
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await callEdge("delete-image-collection", { body: { id } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["collections"] }),
  });
}

export function useCollectionImages(collectionId: string | null) {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery<{ images: CollectionImage[]; total: number }>({
    queryKey: ["collection-images", collectionId],
    queryFn: async () => {
      const res = await callEdge<{ data: { images: CollectionImage[]; total: number } }>(
        `list-collection-images?collection_id=${collectionId}&limit=200`,
        { method: "GET" }
      );
      return res.data;
    },
    enabled: isLoaded && isSignedIn === true && !!collectionId,
    retry: 2,
    retryDelay: 1000,
  });
}

export function useUploadCollectionImages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ collectionId, files }: { collectionId: string; files: File[] }) => {
      const formData = new FormData();
      formData.append("collection_id", collectionId);
      files.forEach((f) => formData.append("file", f));
      const res = await callEdgeMultipart<{ data: { uploaded: number } }>("upload-collection-image", formData);
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["collection-images", vars.collectionId] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

export function useDeleteCollectionImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, collectionId }: { id: string; collectionId: string }) => {
      await callEdge("delete-collection-image", { body: { id } });
      return collectionId;
    },
    onSuccess: (collectionId) => {
      queryClient.invalidateQueries({ queryKey: ["collection-images", collectionId] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}
