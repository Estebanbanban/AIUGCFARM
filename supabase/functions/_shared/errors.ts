export const ErrorCodes = {
  INSUFFICIENT_CREDITS: "INSUFFICIENT_CREDITS",
  RATE_LIMITED: "RATE_LIMITED",
  VIDEO_GENERATION_FAILED: "VIDEO_GENERATION_FAILED",
  CONTENT_POLICY_VIOLATION: "CONTENT_POLICY_VIOLATION",
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_INPUT: "INVALID_INPUT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export function errorResponse(code: ErrorCode, detail: string, status: number, cors: HeadersInit) {
  return new Response(JSON.stringify({ code, detail }), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
