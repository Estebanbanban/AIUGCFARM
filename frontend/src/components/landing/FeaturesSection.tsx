import { Zap, Palette, LayoutList, Shuffle, Copy, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    title: "Zero-Input Import",
    description:
      "Paste your store URL. Products, images, and descriptions are auto-imported in seconds.",
    icon: Zap,
  },
  {
    title: "AI Persona Builder",
    description:
      "Sims-like character creator with 9 attributes. Build once, use across all videos.",
    icon: Palette,
  },
  {
    title: "Hook/Body/CTA Structure",
    description:
      "Every video follows the proven Hook/Body/CTA format optimized for TikTok & Meta ads.",
    icon: LayoutList,
  },
  {
    title: "Mix & Match Segments",
    description:
      "Generate segments independently. Mix any hook with any body and CTA for maximum variety.",
    icon: Shuffle,
  },
  {
    title: "4 Variations Per Batch",
    description:
      "Every generation produces 4 variations to hedge against AI artifacts and find winners.",
    icon: Copy,
  },
  {
    title: "Download & Deploy",
    description:
      "Export as MP4. No watermarks on paid plans. Ready for any ad platform.",
    icon: Download,
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-20 md:py-32">
      {/* Subtle background gradient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-violet-600/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-violet-400">
            Features
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything You Need to Scale Ad Creative
          </h2>
        </div>

        {/* Feature grid */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={cn(
                "group relative rounded-xl border border-white/5 bg-zinc-900/30 p-6 transition-all duration-300",
                "hover:border-violet-500/20 hover:bg-zinc-900/60"
              )}
            >
              {/* Icon */}
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400 transition-colors group-hover:bg-violet-500/20">
                <feature.icon className="size-5" />
              </div>

              {/* Content */}
              <h3 className="text-base font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
