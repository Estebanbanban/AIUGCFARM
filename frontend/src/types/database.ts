export interface User {
  id: string;
  clerk_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Brand {
  id: string;
  user_id: string;
  name: string;
  url: string | null;
  logo_url: string | null;
  tone_of_voice: string | null;
  target_demographic: string | null;
  key_selling_points: string[] | null;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Product {
  id: string;
  brand_id: string;
  user_id: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  primary_image_url: string | null;
  additional_image_urls: string[] | null;
  category: string | null;
  tags: string[] | null;
  source_url: string | null;
  is_confirmed: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type PersonaGender = "male" | "female" | "non_binary";
export type PersonaAgeRange = "18_25" | "25_35" | "35_45" | "45_55" | "55_plus";
export type PersonaBodyType = "slim" | "average" | "athletic" | "curvy" | "plus_size";

export interface Persona {
  id: string;
  user_id: string;
  brand_id: string | null;
  name: string;
  gender: PersonaGender;
  age_range: PersonaAgeRange;
  skin_tone: string;
  hair_color: string;
  hair_style: string;
  eye_color: string;
  body_type: PersonaBodyType;
  clothing_style: string;
  accessories: string[] | null;
  selected_image_url: string | null;
  generated_image_urls: string[] | null;
  kling_element_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type SegmentType = "hook" | "body" | "cta";
export type SegmentStatus = "pending" | "generating_script" | "generating_image" | "generating_video" | "completed" | "failed";

export interface SegmentBatch {
  id: string;
  user_id: string;
  product_id: string;
  persona_id: string;
  pov_image_url: string | null;
  status: string;
  total_segments: number;
  completed_segments: number;
  credits_used: number;
  credits_refunded: number;
  created_at: string;
  updated_at: string;
}

export interface Segment {
  id: string;
  batch_id: string;
  user_id: string;
  type: SegmentType;
  status: SegmentStatus;
  script_text: string | null;
  duration_seconds: number | null;
  video_url: string | null;
  thumbnail_url: string | null;
  kling_task_id: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export type ComboStatus = "pending" | "assembling" | "completed" | "failed";

export interface VideoCombo {
  id: string;
  user_id: string;
  hook_segment_id: string;
  body_segment_id: string;
  cta_segment_id: string;
  status: ComboStatus;
  video_url: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export type SubscriptionStatus = "active" | "past_due" | "canceled" | "trialing" | "incomplete";
export type PlanTier = "starter" | "growth" | "scale";

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  tier: PlanTier;
  status: SubscriptionStatus;
  segment_credits_total: number;
  segment_credits_used: number;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export type CreditTransactionType = "subscription_grant" | "generation_debit" | "refund_credit" | "overage_debit";

export interface CreditTransaction {
  id: string;
  user_id: string;
  subscription_id: string | null;
  batch_id: string | null;
  type: CreditTransactionType;
  amount: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}
