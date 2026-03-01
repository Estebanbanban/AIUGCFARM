"use client";

import { FadeInUp } from "@/lib/motion";

const metrics = [
  { value: "500+", label: "Brands using Cinerads" },
  { value: "< 10 min", label: "Average generation time" },
  { value: "27×", label: "Video combos per batch" },
  { value: "$0.09", label: "Per unique video ad" },
];

export function MetricsBar() {
  return (
    <section className="bg-background py-20 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <FadeInUp className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3">Results</p>
          <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-semibold tracking-tight text-foreground">
            Built for performance-driven{" "}
            <span className="font-serif italic text-primary">e-commerce teams</span>
          </h2>
        </FadeInUp>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-2xl overflow-hidden shadow-[0_14px_36px_rgba(0,0,0,0.07)] dark:shadow-[0_14px_36px_rgba(0,0,0,0.3)]">
          {metrics.map((m) => (
            <div key={m.label} className="bg-card px-6 py-10 md:px-8 md:py-12 text-center">
              <p className="text-5xl md:text-6xl font-semibold tracking-tight text-primary">{m.value}</p>
              <p className="mt-3 text-sm text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
