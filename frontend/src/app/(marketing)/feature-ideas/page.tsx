import type { Metadata } from "next";
import { Rocket } from "lucide-react";
import Link from "next/link";
import { FeatureIdeasForm } from "./FeatureIdeasForm";

export const metadata: Metadata = {
  title: "Feature Ideas | CineRads",
  description:
    "Have an idea to improve CineRads? Share it with us - the best features come from our users.",
};

const onRoadmap = [
  {
    label: "Coming soon",
    color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    items: [
      "Batch download of all video combos as ZIP",
      "Custom brand kit (colors, logo overlay)",
      "Direct publish to TikTok & Instagram",
    ],
  },
  {
    label: "Exploring",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    items: [
      "A/B test analytics per video combo",
      "Multi-language voice synthesis",
      "Team collaboration & shared workspaces",
    ],
  },
  {
    label: "Backlog",
    color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    items: [
      "Custom music / background tracks",
      "Auto-generate product description from URL",
      "Scheduled posting calendar",
    ],
  },
];

export default function FeatureIdeasPage() {
  return (
    <div className="bg-background px-4 pt-40 pb-24 sm:px-6">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-14">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3">
            Feature Ideas
          </p>
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-tight text-foreground">
            Shape the future of CineRads.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Our best features were built from user ideas. If something would
            make your workflow faster or your ads better - we want to hear it.
          </p>
        </div>

        <FeatureIdeasForm />

        {/* Roadmap snapshot */}
        <div className="mt-14 mb-10">
          <h2 className="text-base font-semibold text-foreground mb-5 flex items-center gap-2">
            <Rocket className="size-4 text-primary" />
            What&apos;s already on the roadmap
          </h2>
          <div className="space-y-4">
            {onRoadmap.map((section) => (
              <div key={section.label} className="rounded-2xl border border-border bg-card p-5">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium mb-3 ${section.color}`}>
                  {section.label}
                </span>
                <ul className="space-y-2">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <div className="size-1.5 rounded-full bg-muted-foreground/40 mt-2 shrink-0" />
                      <p className="text-sm text-muted-foreground">{item}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 pl-1">
            Roadmap items may shift based on user demand and technical feasibility.
          </p>
        </div>

        {/* Footer note */}
        <div className="rounded-2xl border border-border bg-card/50 p-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Found a bug instead?</span>{" "}
            Head over to the{" "}
            <Link href="/bug-report" className="text-primary hover:underline">
              Bug Report page
            </Link>
            {" "}or contact us at{" "}
            <a href="mailto:support@cinerads.com" className="text-primary hover:underline">
              support@cinerads.com
            </a>.
          </p>
        </div>

      </div>
    </div>
  );
}
