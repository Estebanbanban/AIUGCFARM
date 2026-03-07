"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { callEdge } from "@/lib/api";
import { getSignedImageUrl } from "@/lib/storage";
import type { Persona, Generation } from "@/types/database";
import type { CreatePersonaInput } from "@/schemas/persona";

export function usePersonas() {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery<Persona[]>({
    queryKey: ["personas"],
    queryFn: async () => {
      const res = await callEdge<{ data: Persona[] }>("list-personas", { method: "GET" });
      return res.data;
    },
    enabled: isLoaded && isSignedIn === true,
    retry: false,
  });
}

export function usePersona(id: string) {
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  return useQuery<Persona>({
    queryKey: ["personas", id],
    queryFn: async () => {
      const res = await callEdge<{ data: Persona[] }>("list-personas", { method: "GET" });
      const persona = res.data.find((p) => p.id === id);
      if (!persona) throw new Error("Persona not found");
      return persona;
    },
    enabled: isLoaded && isSignedIn === true && !!id,
    retry: false,
    initialData: () => {
      const personas = queryClient.getQueryData<Persona[]>(["personas"]);
      return personas?.find((p) => p.id === id);
    },
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(["personas"])?.dataUpdatedAt,
  });
}

export function useCreatePersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePersonaInput) => {
      const res = await callEdge<{ data: Persona }>("generate-persona", {
        body: { ...data, _create_only: true },
      });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personas"] }),
  });
}

export function useUpdatePersona(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<CreatePersonaInput>) => {
      const res = await callEdge<{ data: Persona }>("update-persona", {
        body: { id, ...data },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personas"] });
      queryClient.invalidateQueries({ queryKey: ["personas", id] });
    },
  });
}

export function useDeletePersona(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await callEdge("delete-persona", { body: { id } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personas"] });
      queryClient.invalidateQueries({ queryKey: ["personas", id] });
    },
  });
}

export function useGeneratePersonaImages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; attributes: Record<string, unknown> }) => {
      return callEdge<{
        data: {
          id: string;
          generated_images: string[];
          generated_image_urls: string[];
        };
      }>("generate-persona", {
        body: data,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personas"] }),
  });
}

export function useSelectPersonaImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      persona_id: string;
      image_index: number;
    }) => {
      return callEdge<{
        data: {
          persona_id: string;
          selected_image_url: string;
          signed_url: string | null;
        };
      }>("select-persona-image", { body: data });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personas"] }),
  });
}

export type GenerationWithProduct = Generation & {
  products: { name: string } | null;
};

export function usePersonaGenerations(personaId: string) {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery<GenerationWithProduct[]>({
    queryKey: ["persona-generations", personaId],
    queryFn: async () => {
      const res = await callEdge<{ data: GenerationWithProduct[] }>(
        `list-generations?persona_id=${personaId}`,
        { method: "GET" }
      );
      return res.data;
    },
    enabled: isLoaded && isSignedIn === true && !!personaId,
    retry: false,
  });
}

export function usePersonaMonthlyUsage() {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery<{ personas_created: number; month_year: string } | null>({
    queryKey: ["persona-monthly-usage"],
    queryFn: async () => {
      const res = await callEdge<{ data: { personas_created: number; month_year: string } | null }>(
        "get-persona-monthly-usage",
        { method: "GET" }
      );
      return res.data;
    },
    enabled: isLoaded && isSignedIn === true,
    retry: false,
  });
}

/**
 * Resolves a persona image URL. If the URL is already an HTTP URL it is
 * returned as-is; otherwise it is treated as a Supabase Storage path and
 * a signed URL (1-hour expiry) is generated via the cached storage helper.
 */
export async function resolvePersonaImageUrl(
  url: string | null | undefined
): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("http")) return url;

  const result = await getSignedImageUrl("persona-images", url);
  return result === "/placeholder-product.svg" ? null : result;
}
