"use client";

const categories = [
  "Shopify Brands",
  "DTC Startups",
  "E-Commerce Agencies",
  "Dropshippers",
  "Performance Marketers",
  "Fashion Brands",
  "Beauty & Skincare",
  "Health & Wellness",
  "Home & Living",
  "Sports & Fitness",
  "Pet Products",
  "Tech Accessories",
];

const metrics = [
  { value: "500+", label: "Brands trust CineRads" },
  { value: "< 10 min", label: "Average generation time" },
  { value: "27", label: "Video combos per batch" },
  { value: "$0.09", label: "Per unique video ad" },
];

export function MetricsBar() {
  return (
    <section className="bg-background pb-16 pt-8 md:pb-24 md:pt-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-center text-[clamp(1.25rem,2.2vw,2rem)] font-medium tracking-tight text-foreground">
          Built for performance-driven e-commerce teams
        </p>

        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          {categories.map((cat) => (
            <span
              key={cat}
              className="border border-[#333] rounded-full px-4 py-2 text-sm text-[#888]"
            >
              {cat}
            </span>
          ))}
        </div>

        <div className="mt-10 overflow-hidden rounded-3xl border border-border bg-card shadow-[0_14px_36px_rgba(0,0,0,0.1)] dark:shadow-[0_14px_36px_rgba(0,0,0,0.3)] md:mt-14">
          <div className="grid md:grid-cols-4">
            {metrics.map((m, i) => (
              <div
                key={m.label}
                className={`px-6 py-10 text-center md:px-8 md:py-12 ${
                  i > 0 ? "border-t border-border md:border-l md:border-t-0" : ""
                }`}
              >
                <p className="text-5xl font-semibold tracking-tight text-primary md:text-6xl">{m.value}</p>
                <p className="mt-3 text-[clamp(1rem,1.9vw,1.9rem)] text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
