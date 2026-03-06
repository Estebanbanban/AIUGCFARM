import type { Metadata } from "next";
import { Bug, Mail, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Bug Report | CineRads",
  description:
    "Found a bug? Let us know and we'll fix it fast. Your reports help us make CineRads better for everyone.",
};

const steps = [
  {
    step: "1",
    title: "Describe what happened",
    body: "Tell us what you were doing, what you expected, and what actually happened instead.",
  },
  {
    step: "2",
    title: "Include reproduction steps",
    body: "Step-by-step instructions help us reproduce the bug and fix it much faster.",
  },
  {
    step: "3",
    title: "Attach screenshots or logs",
    body: "A screenshot or browser console error (F12 → Console) gives us the context we need.",
  },
];

const commonBugs = [
  "Video stuck in \"generating\" indefinitely",
  "Stitch & Export fails or shows an error",
  "Script generated in the wrong language",
  "Credits deducted but no video created",
  "Persona image not saving or updating",
  "Login / session expired unexpectedly",
];

export default function BugReportPage() {
  return (
    <div className="bg-background px-4 pt-40 pb-24 sm:px-6">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-14">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3">
            Bug Report
          </p>
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-tight text-foreground">
            Found a bug? We&apos;ll squash it.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Every report goes directly to the engineering team. We triage within
            24 hours and push fixes as fast as possible.
          </p>
        </div>

        {/* CTA card */}
        <a
          href="mailto:bugs@cinerads.com?subject=Bug%20Report%20-%20[Brief%20description]"
          className="group mb-10 flex items-start gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-6 hover:border-primary/60 transition-colors"
        >
          <div className="size-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
            <Bug className="size-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
              Report a bug by email
              <ExternalLink className="size-3.5 text-muted-foreground" />
            </p>
            <p className="text-sm text-primary mt-0.5">bugs@cinerads.com</p>
            <p className="text-xs text-muted-foreground mt-2">
              We reply within 24 hours with a status update.
            </p>
          </div>
        </a>

        {/* How to write a good report */}
        <div className="mb-10">
          <h2 className="text-base font-semibold text-foreground mb-5 flex items-center gap-2">
            <AlertCircle className="size-4 text-primary" />
            How to write a helpful report
          </h2>
          <div className="space-y-3">
            {steps.map((s) => (
              <div
                key={s.step}
                className="flex gap-4 rounded-xl border border-border bg-card p-4"
              >
                <span className="size-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {s.step}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{s.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Common known issues */}
        <div className="mb-10">
          <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-500" />
            Common issues we&apos;re tracking
          </h2>
          <div className="rounded-2xl border border-border bg-card p-5 space-y-2.5">
            {commonBugs.map((bug) => (
              <div key={bug} className="flex items-start gap-2.5">
                <div className="size-1.5 rounded-full bg-primary mt-2 shrink-0" />
                <p className="text-sm text-muted-foreground">{bug}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 pl-1">
            If you&apos;re experiencing one of the above, please still report it — more data points help us prioritise.
          </p>
        </div>

        {/* Footer note */}
        <div className="rounded-2xl border border-border bg-card/50 p-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Prefer live support?</span>{" "}
            Reach us at{" "}
            <a href="mailto:support@cinerads.com" className="text-primary hover:underline">
              support@cinerads.com
            </a>{" "}
            or visit the{" "}
            <Link href="/contact" className="text-primary hover:underline">
              Contact page
            </Link>{" "}
            for all contact options.
          </p>
        </div>

      </div>
    </div>
  );
}
