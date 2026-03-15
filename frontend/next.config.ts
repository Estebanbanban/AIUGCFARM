import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""} blob: https://js.stripe.com https://*.posthog.com https://*.sentry.io https://datafa.st https://*.clerk.accounts.dev https://clerk.cinerads.com https://challenges.cloudflare.com`,
              "style-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://clerk.cinerads.com",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: https://*.supabase.co https://commondatastorage.googleapis.com",
              "worker-src blob:",
              "connect-src 'self' blob: https://*.supabase.co https://*.supabase.in https://api.stripe.com https://*.posthog.com https://*.sentry.io https://datafa.st https://unpkg.com https://*.clerk.accounts.dev https://clerk.cinerads.com https://accounts.cinerads.com https://api.clerk.dev https://clerk-telemetry.com",
              "frame-src https://js.stripe.com https://hooks.stripe.com https://*.clerk.accounts.dev https://clerk.cinerads.com https://accounts.cinerads.com https://challenges.cloudflare.com",
              "font-src 'self' https://*.clerk.accounts.dev https://clerk.cinerads.com",
              "base-uri 'self'",
              "form-action 'self' https://checkout.stripe.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  widenClientFileUpload: true,
  silent: true,
});
