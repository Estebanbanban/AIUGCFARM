import type { Metadata } from "next";
import { Mail, MessageSquare, Twitter } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact | CineRads",
  description: "Get in touch with the CineRads team. We're happy to help.",
};

export default function ContactPage() {
  return (
    <div className="bg-background px-4 pt-40 pb-24 sm:px-6">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-14">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3">
            Get in touch
          </p>
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-tight text-foreground">
            We&apos;d love to hear from you.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Questions about the product, billing, or a partnership idea? We read
            every message and reply within 24 hours.
          </p>
        </div>

        {/* Contact cards */}
        <div className="grid sm:grid-cols-2 gap-4 mb-14">
          <a
            href="mailto:hello@cinerads.com"
            className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-6 hover:border-primary/40 transition-colors"
          >
            <div className="size-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Mail className="size-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                Email us
              </p>
              <p className="text-sm text-muted-foreground mt-1">hello@cinerads.com</p>
              <p className="text-xs text-muted-foreground mt-2">
                General inquiries, billing, partnerships
              </p>
            </div>
          </a>

          <a
            href="mailto:support@cinerads.com"
            className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-6 hover:border-primary/40 transition-colors"
          >
            <div className="size-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <MessageSquare className="size-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                Support
              </p>
              <p className="text-sm text-muted-foreground mt-1">support@cinerads.com</p>
              <p className="text-xs text-muted-foreground mt-2">
                Technical issues, account help
              </p>
            </div>
          </a>
        </div>

        {/* FAQ note */}
        <div className="rounded-2xl border border-border bg-card/50 p-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Before reaching out</span>: check our{" "}
            <a href="/#faq" className="text-primary hover:underline">
              FAQ section
            </a>{" "}
            on the homepage. Most common questions about credits, video quality, and
            supported platforms are answered there.
          </p>
        </div>
      </div>
    </div>
  );
}
