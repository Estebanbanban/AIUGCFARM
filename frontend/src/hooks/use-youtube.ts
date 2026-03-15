"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { callEdge, callEdgeMultipart } from "@/lib/api";
import type { YouTubeConnection, YouTubePublish } from "@/types/database";

// ── Connections ───────────────────────────────────────────────────────────────

/** Fetch the Google OAuth URL to initiate YouTube connection. */
export function useYouTubeConnectUrl() {
  return useMutation({
    mutationFn: async () => {
      const res = await callEdge<{ data: { url: string } }>("youtube-connect");
      return res.data;
    },
  });
}

/** List all YouTube connections for the current user. */
export function useYouTubeConnections() {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery<YouTubeConnection[]>({
    queryKey: ["youtube-connections"],
    queryFn: async () => {
      const res = await callEdge<{ data: YouTubeConnection[] }>(
        "list-youtube-connections",
        { method: "GET" }
      );
      return res.data;
    },
    enabled: isLoaded && isSignedIn === true,
    staleTime: 60_000,
  });
}

/** Complete YouTube OAuth callback (exchange code for tokens). */
export function useYouTubeCallback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { code: string; state: string }) => {
      const res = await callEdge<{ data: { connections: YouTubeConnection[] } }>(
        "youtube-callback",
        { body: input }
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["youtube-connections"] });
    },
  });
}

/** Disconnect a YouTube channel. */
export function useYouTubeDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (connectionId: string) => {
      await callEdge("youtube-disconnect", { body: { connection_id: connectionId } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["youtube-connections"] });
    },
  });
}

// ── Publishing ────────────────────────────────────────────────────────────────

/** Publish a video to YouTube. */
export function usePublishToYouTube() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      generation_id: string;
      connection_id: string;
      title: string;
      description?: string;
      tags?: string[];
      visibility?: "public" | "unlisted" | "private";
    }) => {
      const res = await callEdge<{ data: { publish_id: string; status: string } }>(
        "publish-youtube",
        { body: input, timeoutMs: 300_000 } // 5 min timeout for upload
      );
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["youtube-publishes", variables.generation_id],
      });
    },
  });
}

/** Upload a stitched video blob to Supabase Storage for YouTube publishing. */
export function useUploadStitchedVideo() {
  return useMutation({
    mutationFn: async (input: { generationId: string; blob: Blob }) => {
      const formData = new FormData();
      formData.append("file", input.blob, "stitched.mp4");
      formData.append("generation_id", input.generationId);
      const res = await callEdgeMultipart<{ data: { storage_path: string } }>(
        "upload-stitched-video",
        formData,
        { timeoutMs: 300_000 } // 5 min for large videos
      );
      return res.data;
    },
  });
}

/** Fetch YouTube publish history for a generation. */
export function useYouTubePublishes(generationId: string | null) {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery<(YouTubePublish & { channel_title?: string })[]>({
    queryKey: ["youtube-publishes", generationId],
    queryFn: async () => {
      const res = await callEdge<{ data: (YouTubePublish & { channel_title?: string })[] }>(
        `youtube-publish-status?generation_id=${generationId}`,
        { method: "GET" }
      );
      return res.data;
    },
    enabled: isLoaded && isSignedIn === true && !!generationId,
    staleTime: 30_000,
  });
}
