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
  source: "shopify" | "generic" | "saas";
  brand_summary: Record<string, unknown> | null;
  id: string | null;
}

export interface ScrapeResponseData {
  products: ScrapeProduct[];
  source: "shopify" | "generic" | "saas";
  platform: "shopify" | "generic" | "saas";
  brand_summary: { tone: string; demographic: string; selling_points: string[] } | null;
  brand_summary_error?: string;
  blocked_by_robots?: boolean;
  fallback_available?: boolean;
}

export interface UploadPersonaImageResponse {
  data: {
    persona_id: string;
    storage_path: string;
    signed_url: string;
    generated_images: string[];
  };
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

/** Response from edit-composite-image Edge Function */
export interface EditCompositeImageResponse {
  data: {
    image: { path: string; signed_url: string };
  };
}

/** Response from regenerate-segment Edge Function */
export interface RegenerateSegmentResponse {
  data: {
    generation_id: string;
    status: GenerationStatus;
    job_key: string;
    credits_charged: number;
  };
}

/** Request params for generate-video Edge Function */
export interface CreateGenerationParams {
  product_id: string;
  persona_id: string;
  mode?: "single" | "triple";
  quality?: "standard" | "hd";
  composite_image_path: string;
  /** "script" = generate script only (no credit charge); omit for legacy full flow */
  phase?: "script";
  hooks_count?: number;
  bodies_count?: number;
  ctas_count?: number;
}

/** Request params for approving a script-only generation */
export interface ApproveGenerationParams {
  generation_id: string;
  override_script?: GenerationScript;
  advanced_segments?: AdvancedSegmentsInput;
  video_provider?: "kling" | "sora";
  /** Override quality stored on the generation record (e.g. user switched standard → HD before approving). */
  video_quality?: "standard" | "hd";
  /** Seamless Mode: chain each clip's ending pose to the next clip's starting pose via Kling's
   *  image_tail parameter. Only effective for HD quality (kling-v3). All clips still generate
   *  in parallel — no extra latency. */
  seamless_mode?: boolean;
}

/** Response from generate-video Edge Function */
export interface CreateGenerationResponse {
  data: {
    generation_id: string;
    status: string;
    /** Present when phase="script" - the generated script for review */
    script?: GenerationScript;
    /** Present when phase="script" - credits that will be charged on approval */
    credits_to_charge?: number;
    /** Present on full/approval flow - credits actually charged */
    credits_charged?: number;
    first_video_discount_applied?: boolean;
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
    /** SaaS Demo Mode: signed URL to the uploaded screen recording */
    screen_recording_url?: string | null;
    progress?: { completed: number; total: number };
    segments?: GenerationSegments | null;
    error_message?: string | null;
    completed_at?: string | null;
    hooks_count?: number;
    bodies_count?: number;
    ctas_count?: number;
  };
}

/** A single generation item returned by generation-history */
export interface GenerationHistoryItem {
  id: string;
  product_id: string;
  persona_id: string;
  mode: string;
  type?: string;
  video_quality: Generation["video_quality"];
  kling_model?: Generation["kling_model"];
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

// ── Advanced Mode API types ────────────────────────────────────────────────

export interface AdvancedSegmentInput {
  script_text: string;
  global_emotion: string;
  global_intensity: number;
  action_description?: string;
  image_path?: string;
}

export interface AdvancedSegmentsInput {
  hooks: AdvancedSegmentInput[];
  bodies: AdvancedSegmentInput[];
  ctas: AdvancedSegmentInput[];
}

export interface GenerateSegmentScriptResponse {
  data: { text: string; duration_seconds: number; variant_label: string };
}

export interface GenerateSegmentCompositeResponse {
  data: { image: { path: string; signed_url: string } };
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

/** Single Video Creator — script generation response */
export interface SingleVideoScriptResponse {
  data: {
    generation_id: string;
    status: "awaiting_approval";
    script?: { hook: string; body: string; cta: string; full_text: string };
    freeform_prompt?: string;
    credits_to_charge: number;
  };
}

/** Single Video Creator — submit/approval response */
export interface SingleVideoSubmitResponse {
  data: {
    generation_id: string;
    status: "generating_segments";
    credits_charged: number;
  };
}

/** Single Video Creator — status polling response */
export interface SingleVideoStatusResponse {
  data: {
    status: string;
    progress: number;
    video_url?: string;
    error_message?: string;
  };
}

/** Upload reference image response */
export interface UploadReferenceImageResponse {
  data: { path: string };
}
