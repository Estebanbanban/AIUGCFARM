import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — CineRads",
  description: "CineRads Terms of Service. Last updated February 28, 2026.",
};

export default function TermsPage() {
  return (
    <div className="bg-background px-4 pt-40 pb-24 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3">
            Legal
          </p>
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-tight text-foreground">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Last updated: February 28, 2026
          </p>
        </div>

        <div className="prose-legal">
          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using CineRads (&quot;the Service&quot;), operated by CineRads
              (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you agree to be bound by these Terms of Service
              (&quot;Terms&quot;). If you do not agree to these Terms, do not use the Service.
            </p>
            <p>
              We may update these Terms at any time. Continued use of the Service after
              changes are posted constitutes your acceptance of the revised Terms.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              CineRads is an AI-powered video ad generation platform that allows
              e-commerce brands to create UGC-style video advertisements using artificial
              intelligence. The Service includes:
            </p>
            <ul>
              <li>AI persona creation and management</li>
              <li>Automated script generation (Hook, Body, CTA)</li>
              <li>Video generation using AI models (including Kling)</li>
              <li>Brand profile and product management</li>
              <li>Video storage and download capabilities</li>
            </ul>
          </Section>

          <Section title="3. Account Registration">
            <p>
              You must create an account to use the Service. You agree to provide
              accurate, current, and complete information during registration and to
              update such information to keep it accurate. You are responsible for
              maintaining the confidentiality of your account credentials.
            </p>
            <p>
              You are responsible for all activity that occurs under your account. Notify
              us immediately at support@cinerads.com if you suspect unauthorized access.
            </p>
          </Section>

          <Section title="4. Credits and Billing">
            <p>
              The Service operates on a credit-based system. Credits are consumed when
              generating video content. Credit allocations depend on your subscription
              plan or purchased credit pack.
            </p>
            <ul>
              <li>
                <strong>Subscriptions:</strong> Monthly or annual plans automatically
                renew unless cancelled before the renewal date. Credits reset at the
                start of each billing cycle and do not roll over.
              </li>
              <li>
                <strong>Credit Packs:</strong> One-time purchases that add credits to
                your account. These credits do not expire.
              </li>
              <li>
                <strong>Pricing:</strong> Prices are listed in USD. We reserve the right
                to change pricing with 30 days' notice to existing subscribers.
              </li>
              <li>
                <strong>Refunds:</strong> If your first generation does not meet
                expectations, we offer a 7-day money-back guarantee. Contact
                support@cinerads.com within 7 days of your first purchase.
              </li>
            </ul>
            <p>
              Payments are processed by Stripe. By providing payment information, you
              agree to Stripe&apos;s terms of service. We do not store your payment card
              details.
            </p>
          </Section>

          <Section title="5. Acceptable Use">
            <p>You agree not to use the Service to:</p>
            <ul>
              <li>Generate content that is unlawful, harmful, defamatory, or obscene</li>
              <li>Impersonate any person or entity</li>
              <li>Violate any intellectual property rights</li>
              <li>Generate misleading advertising or deceptive content</li>
              <li>Reverse engineer, decompile, or attempt to extract source code</li>
              <li>Resell or sublicense access to the Service without our consent</li>
              <li>
                Use automated means to access the Service beyond the intended API, if
                any
              </li>
            </ul>
            <p>
              We reserve the right to suspend or terminate accounts that violate these
              restrictions without notice or refund.
            </p>
          </Section>

          <Section title="6. Intellectual Property and Content Ownership">
            <p>
              <strong>Your content:</strong> You retain full ownership of all videos,
              scripts, and creative assets generated through the Service. You grant us a
              limited license to store and process your content solely to provide the
              Service.
            </p>
            <p>
              <strong>Our platform:</strong> CineRads, its logo, software, and all
              related intellectual property are owned by us. Nothing in these Terms
              transfers any ownership of our platform to you.
            </p>
            <p>
              <strong>AI-generated content:</strong> You are responsible for ensuring
              that AI-generated content complies with applicable laws and platform
              guidelines (TikTok, Meta, etc.) before publishing.
            </p>
          </Section>

          <Section title="7. Disclaimers">
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF
              ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE
              UNINTERRUPTED, ERROR-FREE, OR THAT AI-GENERATED CONTENT WILL MEET YOUR
              SPECIFIC REQUIREMENTS OR ACHIEVE PARTICULAR ADVERTISING RESULTS.
            </p>
            <p>
              Video generation quality depends on input data quality, AI model
              performance, and other variables outside our control.
            </p>
          </Section>

          <Section title="8. Limitation of Liability">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, CINERADS SHALL NOT BE LIABLE FOR
              ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
              INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN
              CONNECTION WITH THE SERVICE.
            </p>
            <p>
              OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING FROM OR RELATED TO THE
              SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 3 MONTHS PRECEDING
              THE CLAIM.
            </p>
          </Section>

          <Section title="9. Termination">
            <p>
              You may cancel your subscription at any time from your account settings.
              Cancellation takes effect at the end of your current billing period. No
              refund is issued for the remaining period unless covered by our 7-day
              guarantee.
            </p>
            <p>
              We may suspend or terminate your account immediately if you breach these
              Terms, engage in fraudulent activity, or if required by law.
            </p>
          </Section>

          <Section title="10. Governing Law">
            <p>
              These Terms are governed by and construed in accordance with applicable
              law. Any disputes arising from these Terms shall be resolved through
              binding arbitration or in courts of competent jurisdiction.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              For any questions about these Terms, contact us at:{" "}
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
