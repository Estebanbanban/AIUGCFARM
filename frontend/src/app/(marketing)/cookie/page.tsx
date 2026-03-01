import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy | CineRads",
  description: "CineRads Cookie Policy. How we use cookies and similar technologies.",
};

export default function CookiePage() {
  return (
    <div className="bg-background px-4 pt-40 pb-24 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3">
            Legal
          </p>
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-tight text-foreground">
            Cookie Policy
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Last updated: February 28, 2026
          </p>
        </div>

        <div>
          <Section title="1. What Are Cookies">
            <p>
              Cookies are small text files stored on your device when you visit a
              website. They help websites remember your preferences, keep you logged in,
              and understand how you use the site.
            </p>
            <p>
              We also use similar technologies like localStorage (browser storage) to
              achieve similar purposes.
            </p>
          </Section>

          <Section title="2. Types of Cookies We Use">
            <CookieTable
              cookies={[
                {
                  name: "Strictly Necessary",
                  provider: "Supabase",
                  purpose:
                    "Authentication session management. Keep you logged in, manage your session token.",
                  duration: "Session / up to 1 year",
                  canOptOut: false,
                },
                {
                  name: "Functional",
                  provider: "CineRads",
                  purpose:
                    "Remember your preferences (e.g. theme: dark/light, cookie consent choice).",
                  duration: "Up to 1 year",
                  canOptOut: false,
                },
                {
                  name: "Analytics",
                  provider: "PostHog",
                  purpose:
                    "Understand how users navigate the product, measure feature adoption, and improve the Service.",
                  duration: "Up to 1 year",
                  canOptOut: true,
                },
              ]}
            />
          </Section>

          <Section title="3. Strictly Necessary Cookies">
            <p>
              These cookies are essential for the Service to function. Without them, you
              cannot log in, save your work, or use the platform. They cannot be
              disabled.
            </p>
            <p>Examples:</p>
            <ul>
              <li>
                <strong>sb-access-token</strong>: Supabase authentication token that
                keeps you logged in
              </li>
              <li>
                <strong>sb-refresh-token</strong>: Used to refresh your session
                without requiring re-login
              </li>
              <li>
                <strong>cinerads-theme</strong>: Stores your dark/light mode
                preference
              </li>
            </ul>
          </Section>

          <Section title="4. Analytics Cookies (PostHog)">
            <p>
              With your consent, we use PostHog to collect anonymized usage data. This
              helps us understand which features are used, where users drop off, and
              how to improve the product.
            </p>
            <p>PostHog may set the following cookies/localStorage keys:</p>
            <ul>
              <li>
                <strong>ph_*</strong>: PostHog session and distinct user ID (anonymous)
              </li>
            </ul>
            <p>
              PostHog does not sell your data. Analytics are processed on
              PostHog&apos;s infrastructure. You can review PostHog&apos;s privacy policy at{" "}
              <a
                href="https://posthog.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                posthog.com/privacy
              </a>
              .
            </p>
          </Section>

          <Section title="5. Managing Your Cookie Preferences">
            <p>
              When you first visit CineRads, a cookie banner appears at the bottom of
              your screen. You can:
            </p>
            <ul>
              <li>
                <strong>Accept all</strong>: enables analytics cookies in addition to
                strictly necessary ones
              </li>
              <li>
                <strong>Decline</strong>: only strictly necessary cookies will be
                active
              </li>
            </ul>
            <p>
              You can change your preference at any time by clearing your browser&apos;s
              localStorage (key: <code className="text-primary text-xs">cinerads-cookie-consent</code>) or
              by clearing your browser cookies.
            </p>
            <p>
              You can also control cookies through your browser settings. Note that
              disabling all cookies may prevent some features of the Service from
              working correctly.
            </p>
          </Section>

          <Section title="6. Third-Party Cookies">
            <p>
              Some third-party services embedded in CineRads may set their own cookies:
            </p>
            <ul>
              <li>
                <strong>Stripe</strong>: used during checkout to prevent fraud.
                Governed by{" "}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Stripe&apos;s Privacy Policy
                </a>
                .
              </li>
            </ul>
          </Section>

          <Section title="7. Contact">
            <p>
              For cookie-related questions:{" "}
              <a href="mailto:hello@cinerads.com" className="text-primary hover:underline">
                hello@cinerads.com
              </a>
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-10">
      <h2 className="text-lg font-semibold text-foreground mb-4 border-b border-border pb-2">
        {title}
      </h2>
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-foreground [&_strong]:font-medium">
        {children}
      </div>
    </div>
  );
}

function CookieTable({
  cookies,
}: {
  cookies: {
    name: string;
    provider: string;
    purpose: string;
    duration: string;
    canOptOut: boolean;
  }[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-card/60">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Provider
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">
              Purpose
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
              Duration
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Optional
            </th>
          </tr>
        </thead>
        <tbody>
          {cookies.map((c, i) => (
            <tr
              key={i}
              className={i < cookies.length - 1 ? "border-b border-border" : ""}
            >
              <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                {c.name}
              </td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                {c.provider}
              </td>
              <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                {c.purpose}
              </td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap hidden md:table-cell">
                {c.duration}
              </td>
              <td className="px-4 py-3">
                {c.canOptOut ? (
                  <span className="text-xs text-primary font-medium">Yes</span>
                ) : (
                  <span className="text-xs text-muted-foreground">No</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
