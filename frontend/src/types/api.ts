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
}

export interface ScrapeResponse {
  data: ScrapeResponseData;
}

export interface ConfirmProductsResponse {
  data: { confirmed: Array<{ id: string; updated: boolean }> };
}
