"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { callEdge } from "@/lib/api";
import type { Persona, Generation } from "@/types/database";
import type { CreatePersonaInput } from "@/schemas/persona";

export function usePersonas() {
  return useQuery<Persona[]>({
    queryKey: ["personas"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("personas")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function usePersona(id: string) {
  return useQuery<Persona>({
    queryKey: ["personas", id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("personas")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreatePersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePersonaInput) => {
      const supabase = createClient();
      const { data: persona, error } = await supabase
        .from("personas")
        .insert(data)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return persona as Persona;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personas"] }),
  });
}

export function useUpdatePersona(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<CreatePersonaInput>) => {
      const supabase = createClient();
      const { data: persona, error } = await supabase
        .from("personas")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return persona as Persona;
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
      const supabase = createClient();
      const { error } = await supabase
        .from("personas")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw new Error(error.message);
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
  return useQuery<GenerationWithProduct[]>({
    queryKey: ["persona-generations", personaId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("generations")
        .select("*, products(name)")
        .eq("persona_id", personaId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data as GenerationWithProduct[];
    },
    enabled: !!personaId,
  });
}

/**
 * Resolves a persona image URL. If the URL is already an HTTP URL it is
 * returned as-is; otherwise it is treated as a Supabase Storage path and
 * a signed URL (1-hour expiry) is generated.
 */
export async function resolvePersonaImageUrl(
  url: string | null | undefined
): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("http")) return url;

  const supabase = createClient();
  const { data } = await supabase.storage
    .from("persona-images")
    .createSignedUrl(url, 3600);
  return data?.signedUrl ?? null;
}
