"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

const CONSENT_KEY = "cinerads-cookie-consent";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
      capture_pageview: false, // Controlled manually based on consent
      capture_pageleave: false,
      persistence: "localStorage",
      opt_out_capturing_by_default: true, // No tracking until consent
    });

    // If user already accepted, opt in
    const consent = localStorage.getItem(CONSENT_KEY);
    if (consent === "accepted") {
      posthog.opt_in_capturing();
      posthog.capture("$pageview");
    }
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
