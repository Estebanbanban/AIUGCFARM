"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Persona } from "@/types/database";
import type { ApiResponse } from "@/types/api";
import type { CreatePersonaInput } from "@/schemas/persona";

export function usePersonas() {
  return useQuery<Persona[]>({
    queryKey: ["personas"],
    queryFn: async () => {
      const res = await fetch("/api/personas");
      const json: ApiResponse<Persona[]> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
  });
}

export function usePersona(id: string) {
  return useQuery<Persona>({
    queryKey: ["personas", id],
    queryFn: async () => {
      const res = await fetch(`/api/personas/${id}`);
      const json: ApiResponse<Persona> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    enabled: !!id,
  });
}

export function useCreatePersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePersonaInput) => {
      const res = await fetch("/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json: ApiResponse<Persona> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personas"] }),
  });
}

export function useUpdatePersona(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<CreatePersonaInput>) => {
      const res = await fetch(`/api/personas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json: ApiResponse<Persona> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
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
      const res = await fetch(`/api/personas/${id}`, { method: "DELETE" });
      const json: ApiResponse<{ success: boolean }> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personas"] }),
  });
}

export function useGeneratePersonaImages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { persona_id: string }) => {
      const res = await fetch("/api/personas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json: ApiResponse<{ image_urls: string[] }> = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personas"] }),
  });
}
