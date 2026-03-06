import type { Metadata } from "next";
import { Lightbulb, Mail, Rocket, ThumbsUp, ExternalLink } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Feature Ideas | CineRads",
  description:
    "Have an idea to improve CineRads? Share it with us — the best features come from our users.",
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

const tips = [
  {
    icon: "💡",
    title: "Describe the problem, not the solution",
    body: "\"I can't easily find which ad combo performed best\" is more useful than \"add a graph\".",
  },
  {
    icon: "🎯",
    title: "Tell us your use case",
    body: "Who would benefit? How often would you use it? This helps us gauge priority.",
  },
  {
    icon: "📣",
    title: "Vote with others",
    body: "Mention ideas that overlap with things you've already seen requested — it helps us spot patterns.",
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
            make your workflow faster or your ads better — we want to hear it.
          </p>
        </div>

        {/* CTA card */}
        <a
          href="mailto:ideas@cinerads.com?subject=Feature%20Idea%20-%20[Brief%20title]"
          className="group mb-10 flex items-start gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-6 hover:border-primary/60 transition-colors"
        >
          <div className="size-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
            <Lightbulb className="size-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
              Submit your idea by email
              <ExternalLink className="size-3.5 text-muted-foreground" />
            </p>
            <p className="text-sm text-primary mt-0.5">ideas@cinerads.com</p>
            <p className="text-xs text-muted-foreground mt-2">
              Every idea is read by the product team. We reply when your idea moves to the roadmap.
            </p>
          </div>
        </a>

        {/* Tips */}
        <div className="mb-10">
          <h2 className="text-base font-semibold text-foreground mb-5 flex items-center gap-2">
            <ThumbsUp className="size-4 text-primary" />
            Tips for a great submission
          </h2>
          <div className="space-y-3">
            {tips.map((tip) => (
              <div
                key={tip.title}
                className="flex gap-4 rounded-xl border border-border bg-card p-4"
              >
                <span className="text-xl shrink-0 mt-0.5">{tip.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{tip.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{tip.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Roadmap snapshot */}
        <div className="mb-10">
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
