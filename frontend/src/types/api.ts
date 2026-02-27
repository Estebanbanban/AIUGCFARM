export type ApiResponse<T> =
  | { data: T; error: null }
  | { data: null; error: { code: string; message: string; field?: string } };

export type PaginatedResponse<T> = {
  data: { items: T[]; total: number; page: number; pageSize: number };
  error: null;
};

export function success<T>(data: T): ApiResponse<T> {
  return { data, error: null };
}

export function error<T = never>(code: string, message: string, field?: string): ApiResponse<T> {
  return { data: null, error: { code, message, field } };
}

export interface ScrapeProduct {
  name: string;
  description: string;
  price: number | null;
  currency: string;
  images: string[];
  category: string | null;
  source: "shopify" | "generic";
  brand_summary: Record<string, unknown> | null;
  id: string | null;
}

export interface ScrapeResponseData {
  products: ScrapeProduct[];
  source: "shopify" | "generic";
  brand_summary: { tone: string; demographic: string; selling_points: string[] } | null;
  brand_summary_error?: string;
  blocked_by_robots?: boolean;
  fallback_available?: boolean;
  saved: boolean;
  save_failed?: boolean;
  save_error?: string | null;
}

export interface ScrapeResponse {
  data: ScrapeResponseData;
}

export interface ConfirmProductsResponse {
  data: { confirmed: Array<{ id: string; updated: boolean }> };
}

/* -------------------------------------------------------------------------- */
/*  Generation (Epic 6) response types                                        */
/* -------------------------------------------------------------------------- */

import type {
  Generation,
  GenerationStatus,
  GenerationScript,
  GenerationSegments,
} from "./database";

/** Response from generate-composite-images Edge Function */
export interface CompositeImagesResponse {
  data: {
    images: Array<{ path: string; signed_url: string }>;
  };
}

/** Response from generate-video Edge Function */
export interface CreateGenerationResponse {
  data: {
    generation_id: string;
    status: string;
  };
}

/** Response from video-status Edge Function */
export interface GenerationProgressResponse {
  data: {
    generation_id: string;
    status: GenerationStatus;
    mode?: Generation["mode"];
    script?: GenerationScript | null;
    composite_image_url?: string | null;
    progress?: { completed: number; total: number };
    segments?: GenerationSegments | null;
    error_message?: string | null;
    completed_at?: string | null;
  };
}

/** A single generation item returned by generation-history */
export interface GenerationHistoryItem {
  id: string;
  product_id: string;
  persona_id: string;
  mode: string;
  video_quality: Generation["video_quality"];
  status: GenerationStatus;
  script: GenerationScript | null;
  composite_image_url: string | null;
  videos: GenerationSegments | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  products: { name: string; images: string[] } | null;
  personas: { name: string; selected_image_url: string | null } | null;
}

/** Response from generation-history Edge Function */
export interface GenerationHistoryResponse {
  data: {
    generations: GenerationHistoryItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
      has_next: boolean;
      has_prev: boolean;
    };
  };
}
