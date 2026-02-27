/**
 * DataFast analytics goal tracking utilities.
 * Typed wrappers around window.datafast() for all CineRads funnel events.
 */

declare global {
  interface Window {
    datafast?: (goal: string, params?: Record<string, string>) => void;
  }
}

function track(goal: string, params?: Record<string, string>) {
  window?.datafast?.(goal, params);
}

// ── Auth ────────────────────────────────────────────────────────────────────

export function trackSignup(method: "email" | "google") {
  track("signup", { method });
}

export function trackLogin(method: "email" | "google") {
  track("login", { method });
}

// ── Product import ──────────────────────────────────────────────────────────

export function trackProductImported(source: "url" | "manual") {
  track("product_imported", { source });
}

// ── Persona ─────────────────────────────────────────────────────────────────

export function trackPersonaCreated() {
  track("persona_created");
}

// ── Generation wizard ────────────────────────────────────────────────────────

export function trackPreviewGenerated() {
  track("preview_generated");
}

export function trackScriptGenerated(mode: string, quality: string) {
  track("script_generated", { mode, quality });
}

export function trackVideoGenerationStarted(mode: string, quality: string) {
  track("video_generation_started", { mode, quality });
}

export function trackVideoCompleted(mode: string) {
  track("video_completed", { mode });
}

// ── Paywall & billing ────────────────────────────────────────────────────────

export function trackPaywallShown(trigger: "insufficient_credits" | "upgrade_prompt") {
  track("paywall_shown", { trigger });
}

export function trackCheckoutStarted(plan: string) {
  track("checkout_started", { plan });
}

export function trackCreditsPurchased(pack: string) {
  track("credits_purchased", { pack });
}
