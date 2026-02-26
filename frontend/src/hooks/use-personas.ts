"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { callEdge } from "@/lib/api";
import type { Persona } from "@/types/database";
import type { CreatePersonaInput } from "@/schemas/persona";

export function usePersonas() {
  return useQuery<Persona[]>({
    queryKey: ["personas"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("personas")
        .select("*")
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
      const { error } = await supabase.from("personas").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personas"] }),
  });
}

export function useGeneratePersonaImages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { persona_id: string }) => {
      return callEdge<{ image_urls: string[] }>("generate-persona", {
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
      image_url: string;
    }) => {
      return callEdge<Persona>("select-persona-image", { body: data });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personas"] }),
  });
}
