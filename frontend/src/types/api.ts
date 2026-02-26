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
