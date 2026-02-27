export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: "free" | "starter" | "growth" | "scale";
  role: "user" | "admin";
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  owner_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  plan: "starter" | "growth" | "scale";
  status: "active" | "past_due" | "canceled" | "incomplete";
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditBalance {
  id: string;
  owner_id: string;
  remaining: number;
  updated_at: string;
}

export interface CreditLedgerEntry {
  id: string;
  owner_id: string;
  amount: number;
  reason:
    | "subscription_renewal"
    | "generation"
    | "refund"
    | "bonus"
    | "free_trial";
  reference_id: string | null;
  created_at: string;
}

export interface BrandSummary {
  tone: string;
  demographic: string;
  selling_points: string[];
}

export interface Product {
  id: string;
  owner_id: string;
  store_url: string | null;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  category: string | null;
  images: string[];
  brand_summary: BrandSummary | null;
  source: "shopify" | "generic" | "manual";
  confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export interface PersonaAttributes {
  gender: string;
  skin_tone: string;
  age: string;
  hair_color: string;
  hair_style: string;
  eye_color: string;
  body_type: string;
  clothing_style: string;
  accessories: string[];
}

export interface Persona {
  id: string;
  owner_id: string;
  name: string;
  attributes: PersonaAttributes;
  selected_image_url: string | null;
  generated_images: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GenerationScript {
  hook: { text: string; duration: number };
  body: { text: string; duration: number };
  cta: { text: string; duration: number };
}

export interface GenerationVideo {
  url: string;
  thumbnail_url: string;
  duration: number;
  variation_index: number;
}

export type GenerationStatus =
  | "pending"
  | "scripting"
  | "generating_image"
  | "submitting_jobs"
  | "generating_segments"
  | "generating_video"
  | "stitching"
  | "completed"
  | "failed";

export interface Generation {
  id: string;
  owner_id: string;
  product_id: string;
  persona_id: string;
  mode: "easy" | "expert";
  status: GenerationStatus;
  script: GenerationScript | null;
  composite_image_url: string | null;
  videos: GenerationVideo[];
  error_message: string | null;
  external_job_ids: Record<string, string>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}
