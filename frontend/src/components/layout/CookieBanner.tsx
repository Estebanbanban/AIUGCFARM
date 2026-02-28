"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import posthog from "posthog-js";

const CONSENT_KEY = "cinerads-cookie-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      // Small delay so it doesn't flash immediately on page load
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
    // Opt PostHog in and track the current page
    posthog.opt_in_capturing();
    posthog.capture("$pageview");
  };

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    setVisible(false);
    posthog.opt_out_capturing();
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[200] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 sm:bottom-6">
      <div className="relative flex flex-col gap-3 rounded-2xl border border-border bg-background/95 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:flex-row sm:items-center sm:gap-4">
        {/* Close */}
        <button
          onClick={decline}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Decline cookies"
        >
          <X className="size-3.5" />
        </button>

        {/* Text */}
        <div className="flex-1 pr-4">
          <p className="text-sm font-medium text-foreground">
            We use cookies 🍪
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            Strictly necessary cookies are always active. With your consent, we use
            analytics cookies (PostHog) to improve the product.{" "}
            <Link href="/cookie" className="text-primary hover:underline">
              Cookie policy
            </Link>
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={decline}
            className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:border-border/80 hover:text-foreground transition-colors"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
