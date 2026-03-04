import * as Sentry from "npm:@sentry/deno";

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
  });
  initialized = true;
}

export function captureException(err: unknown): void {
  try {
    initSentry();
    Sentry.captureException(err);
  } catch {
    // Sentry must never break the main flow
  }
}
