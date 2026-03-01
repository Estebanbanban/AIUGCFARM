import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | CineRads",
  description: "CineRads Privacy Policy. Last updated February 28, 2026.",
};

export default function PrivacyPage() {
  return (
    <div className="bg-background px-4 pt-40 pb-24 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3">
            Legal
          </p>
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-tight text-foreground">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Last updated: February 28, 2026
          </p>
        </div>

        <div>
          <Section title="1. Who We Are">
            <p>
              CineRads (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;) operates the CineRads platform at
              cinerads.com. This Privacy Policy explains how we collect, use, and
              protect your personal data when you use our Service.
            </p>
            <p>
              Contact:{" "}
              <a href="mailto:hello@cinerads.com" className="text-primary hover:underline">
                hello@cinerads.com
              </a>
            </p>
          </Section>

          <Section title="2. Data We Collect">
            <p>
              <strong>Account data:</strong> Email address, name, and profile
              information provided during sign-up.
            </p>
            <p>
              <strong>Payment data:</strong> Billing information is processed by Stripe.
              We do not store payment card numbers. We retain billing history (plan,
              amount, date) for accounting purposes.
            </p>
            <p>
              <strong>Usage data:</strong> Information about how you use the Service,
              including product URLs submitted, AI personas created, videos generated,
              and credit consumption.
            </p>
            <p>
              <strong>Technical data:</strong> IP address, browser type, device
              information, and pages visited. Collected automatically via analytics
              tools.
            </p>
            <p>
              <strong>Content data:</strong> Product data, scripts, and video assets
              you create or upload through the Service.
            </p>
          </Section>

          <Section title="3. How We Use Your Data">
            <ul>
              <li>To provide and improve the Service</li>
              <li>To process payments and manage your subscription</li>
              <li>
                To send transactional emails (generation complete, billing receipts,
                security alerts)
              </li>
              <li>To analyze usage and improve product features</li>
              <li>To comply with legal obligations</li>
              <li>
                To send product updates and offers: you can opt out at any time
              </li>
            </ul>
          </Section>

          <Section title="4. Third-Party Services">
            <p>We use the following third-party services to operate CineRads:</p>
            <ul>
              <li>
                <strong>Supabase</strong>: authentication, database, and file storage
                (EU/US data centers)
              </li>
              <li>
                <strong>Stripe</strong>: payment processing and subscription
                management
              </li>
              <li>
                <strong>PostHog</strong>: product analytics (only with your consent via
                cookie banner)
              </li>
              <li>
                <strong>OpenRouter / Kling AI</strong>: AI script and video generation
                (your content is processed but not used to train models)
              </li>
              <li>
                <strong>Vercel</strong>: hosting and edge infrastructure
              </li>
            </ul>
            <p>
              Each provider has their own privacy policy. We only share the minimum data
              necessary for each service to function.
            </p>
          </Section>

          <Section title="5. Cookies">
            <p>
              We use cookies and similar tracking technologies. See our{" "}
              <a href="/cookie" className="text-primary hover:underline">
                Cookie Policy
              </a>{" "}
              for full details.
            </p>
            <p>
              <strong>Strictly necessary cookies</strong> (authentication, session
              management) are always active. Analytics cookies (PostHog) only activate
              after you consent via our cookie banner.
            </p>
          </Section>

          <Section title="6. Data Retention">
            <p>
              We retain your account data for as long as your account is active. If you
              delete your account, we will delete your personal data within 30 days,
              except where we are required by law to retain it longer (e.g., billing
              records for 7 years).
            </p>
            <p>
              Generated videos are stored for 90 days after creation or until you
              delete them, whichever comes first.
            </p>
          </Section>

          <Section title="7. Your Rights">
            <p>Depending on your location, you may have the right to:</p>
            <ul>
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data (&quot;right to be forgotten&quot;)</li>
              <li>Object to or restrict processing of your data</li>
              <li>Data portability: receive your data in a structured format</li>
              <li>Withdraw consent at any time (where processing is consent-based)</li>
            </ul>
            <p>
              To exercise any of these rights, email{" "}
              <a href="mailto:hello@cinerads.com" className="text-primary hover:underline">
                hello@cinerads.com
              </a>
              . We will respond within 30 days.
            </p>
          </Section>

          <Section title="8. Data Security">
            <p>
              We implement industry-standard security measures, including:
            </p>
            <ul>
              <li>Encrypted data in transit (HTTPS/TLS)</li>
              <li>Row-level security on our database (Supabase RLS)</li>
              <li>Access controls: only authenticated users can access their data</li>
              <li>Regular security reviews</li>
            </ul>
            <p>
              No method of transmission over the internet is 100% secure. We cannot
              guarantee absolute security but we take every reasonable precaution.
            </p>
          </Section>

          <Section title="9. International Transfers">
            <p>
              Your data may be processed in the United States and other countries where
              our service providers operate. By using CineRads, you consent to this
              transfer. We ensure appropriate safeguards are in place.
            </p>
          </Section>

          <Section title="10. Children">
            <p>
              The Service is not directed at children under 16. We do not knowingly
              collect personal data from children. If you believe a child has provided
              us with personal data, contact us and we will delete it.
            </p>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>
              We may update this Privacy Policy periodically. We will notify you of
              material changes by email or via a banner on the platform. Continued use
              after changes constitutes acceptance of the revised policy.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>
              For privacy-related questions or requests:{" "}
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
