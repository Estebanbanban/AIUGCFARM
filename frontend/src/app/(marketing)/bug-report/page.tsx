import type { Metadata } from "next";
import { BugReportForm } from "./BugReportForm";

export const metadata: Metadata = {
  title: "Bug Report | CineRads",
  description:
    "Found a bug? Let us know and we'll fix it fast. Your reports help us make CineRads better for everyone.",
};

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

        <BugReportForm />

      </div>
    </div>
  );
}
