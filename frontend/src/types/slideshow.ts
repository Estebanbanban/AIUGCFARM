// Image Collections
export interface ImageCollection {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  image_count: number;
  created_at: string;
  updated_at: string;
  preview_images?: string[]; // signed URLs for first 4 images
}

export interface CollectionImage {
  id: string;
  collection_id: string;
  owner_id: string;
  storage_path: string;
  filename: string;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  url?: string; // signed URL
  created_at: string;
}

// Slideshow
export interface SlideshowSettings {
  aspectRatio: "9:16";
  slideDuration: number;
  resolution: { width: number; height: number };
  overlay: {
    enabled: boolean;
    opacity: number;
    color: string;
  };
  text: {
    position: "top-third" | "center" | "bottom-third";
    color: string;
    case: "lowercase" | "uppercase" | "titlecase";
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    textShadow: boolean;
  };
  captionStyle: "tiktok" | "instagram" | "inter";
  showPill: boolean;
}

export interface SlideTextContent {
  title: string;    // The numbered point in the white pill
  subtitle: string; // The context/complaint line (white text)
  action: string;   // The action/CTA line (white text)
}

export interface Slide {
  id: string;
  type: "hook" | "body" | "cta";
  order: number;
  imageId: string | null;
  imageUrl: string | null;
  text: string;           // For hook slides: the full hook text
  textContent?: SlideTextContent; // For body slides: structured text
  overlayOpacity?: number;
  duration?: number;
}

export interface Slideshow {
  id: string;
  owner_id: string;
  name: string;
  status: "draft" | "rendering" | "complete" | "failed";
  settings: SlideshowSettings;
  slides: Slide[];
  video_storage_path: string | null;
  video_duration_seconds: number | null;
  product_id: string | null;
  hook_text: string | null;
  exported_at: string | null;
  created_at: string;
  updated_at: string;
  thumbnail_url?: string; // signed URL for first slide
}

export interface SlideshowHook {
  id: string;
  owner_id: string;
  product_id: string | null;
  niche: string | null;
  text: string;
  is_used: boolean;
  created_at: string;
}

export interface GeneratedSlideCopy {
  type: "body" | "cta";
  title: string;
  subtitle: string;
  action: string;
  order: number;
}

// Default settings
export const DEFAULT_SLIDESHOW_SETTINGS: SlideshowSettings = {
  aspectRatio: "9:16",
  slideDuration: 2,
  resolution: { width: 1080, height: 1920 },
  overlay: {
    enabled: true,
    opacity: 0.25,
    color: "#000000",
  },
  text: {
    position: "top-third",
    color: "#FFFFFF",
    case: "lowercase",
    fontFamily: "Inter",
    fontSize: 48,
    fontWeight: 700,
    textShadow: true,
  },
  captionStyle: "tiktok",
  showPill: true,
};
