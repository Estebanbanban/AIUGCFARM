"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FadeInUp, ScaleIn } from "@/lib/motion";

/* ──────────────────────────────────────────
   PART A — Scroll-linked feature showcase
   ────────────────────────────────────────── */

const features = [
  {
    id: "import",
    title: "Zero-Input Product Import",
    description:
      "Paste any store URL and we pull products, images, prices, and descriptions automatically. No CSV uploads, no data entry.",
    learnMore: "Works with Shopify, WooCommerce, and any public product page.",
  },
  {
    id: "persona",
    title: "AI Persona Builder",
    description:
      "Design a virtual spokesperson with 9 brand attributes. Tone, energy, style, age — saved and reused across every campaign.",
    learnMore: "Create unlimited personas per brand.",
  },
  {
    id: "generate",
    title: "Smart Video Generation",
    description:
      "AI writes Hook/Body/CTA scripts tailored to your product and persona. Each segment is generated as a short, crisp video clip.",
    learnMore: "Under 10s per segment for perfect lip-sync.",
  },
  {
    id: "mixer",
    title: "Segment Mixer",
    description:
      "Mix and match 3 hooks, 3 bodies, and 3 CTAs to produce up to 27 unique video combinations from a single generation.",
    learnMore: "A/B test at scale without extra cost.",
  },
] as const;

type FeatureId = (typeof features)[number]["id"];

/* ── Mockup: Import ── */
function MockImport() {
  const products = [
    { name: "Hydra Serum", price: "$45" },
    { name: "Cloud Runner", price: "$129" },
    { name: "Vital Blend", price: "$39" },
  ];
  return (
    <div className="space-y-3">
      {products.map((p, i) => (
        <motion.div
          key={p.name}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.15, duration: 0.4 }}
          className="flex items-center gap-3 rounded-xl bg-[#141414] border border-[#222] p-3"
        >
          <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] flex items-center justify-center shrink-0">
            <div className="w-5 h-5 rounded bg-[#222]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{p.name}</p>
            <p className="text-xs text-[#555]">{p.price}</p>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        </motion.div>
      ))}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="rounded-xl bg-[#141414] border border-[#222] p-3"
      >
        <p className="text-[10px] uppercase tracking-wider text-[#555] mb-1">Brand Summary</p>
        <p className="text-xs text-[#888]">Premium skincare & lifestyle. Target: 25-34 women.</p>
      </motion.div>
    </div>
  );
}

/* ── Mockup: Persona ── */
function MockPersona() {
  const attrs = [
    { name: "Tone", fill: 70 },
    { name: "Energy", fill: 55 },
    { name: "Style", fill: 85 },
    { name: "Age", fill: 45 },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-[#1a1a1a] border border-[#222] flex items-center justify-center">
          <span className="text-lg font-bold text-[#444]">CR</span>
        </div>
        <div>
          <p className="text-sm font-medium text-white">AI Spokesperson</p>
          <p className="text-xs text-[#555]">9 attributes configured</p>
        </div>
      </div>
      {attrs.map((a, i) => (
        <div key={a.name} className="space-y-1.5">
          <div className="flex justify-between">
            <span className="text-xs text-[#888]">{a.name}</span>
            <span className="text-[10px] text-[#555] font-mono">{a.fill}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#1a1a1a] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${a.fill}%` }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.6, ease: "easeOut" }}
              className="h-full rounded-full bg-primary"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Mockup: Generate ── */
function MockGenerate() {
  const segments = [
    { label: "HOOK", color: "border-primary", text: "\"Stop scrolling. This changed my skin in 7 days.\"" },
    { label: "BODY", color: "border-white/20", text: "\"Hydra Serum uses clinically-tested peptides that actually penetrate.\"" },
    { label: "CTA", color: "border-green-500/50", text: "\"Tap below and try it risk-free for 30 days.\"" },
  ];
  return (
    <div className="space-y-3">
      {segments.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.15, duration: 0.4 }}
          className={`rounded-xl bg-[#141414] border border-[#222] p-4 border-l-2 ${s.color}`}
        >
          <p className="text-[10px] uppercase tracking-wider text-[#555] mb-1.5 font-mono">{s.label}</p>
          <p className="text-xs text-[#888] leading-relaxed">{s.text}</p>
        </motion.div>
      ))}
    </div>
  );
}

/* ── Mockup: Mixer ── */
function MockMixer() {
  const columns = [
    { title: "Hooks", items: ["Hook A", "Hook B", "Hook C"] },
    { title: "Bodies", items: ["Body A", "Body B", "Body C"] },
    { title: "CTAs", items: ["CTA A", "CTA B", "CTA C"] },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {columns.map((col) => (
          <div key={col.title} className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-[#555] text-center font-mono">
              {col.title}
            </p>
            {col.items.map((item, j) => (
              <div
                key={item}
                className={`rounded-lg border p-2 text-center text-[11px] transition-colors ${
                  j === 0
                    ? "border-primary/40 bg-primary/10 text-primary font-medium"
                    : "border-[#222] bg-[#141414] text-[#555]"
                }`}
              >
                {item}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 pt-1">
        <span className="text-xs text-[#555] font-mono">3 x 3 x 3 =</span>
        <span className="text-sm font-semibold text-primary">27 combos</span>
      </div>
    </div>
  );
}

const mockups: Record<FeatureId, () => React.ReactElement> = {
  import: MockImport,
  persona: MockPersona,
  generate: MockGenerate,
  mixer: MockMixer,
};

function FeatureShowcase() {
  const [active, setActive] = useState<FeatureId>("import");
  const ActiveMockup = mockups[active];

  return (
    <section className="bg-[#0A0A0A] py-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <FadeInUp className="mb-16">
          <p className="text-xs uppercase tracking-[0.15em] text-[#555] mb-3">Features</p>
          <h2 className="text-[clamp(2rem,4vw,3rem)] font-semibold tracking-tight text-white">
            Everything You Need to Ship UGC Ads
          </h2>
        </FadeInUp>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left — Feature sidebar */}
          <div className="lg:sticky lg:top-24 lg:self-start space-y-0">
            {features.map((f) => {
              const isActive = active === f.id;
              return (
                <div
                  key={f.id}
                  className="border-b border-[#1a1a1a] last:border-b-0"
                >
                  <button
                    onClick={() => setActive(f.id)}
                    className="w-full text-left py-5 group"
                  >
                    <div className="flex items-center gap-3">
                      {isActive && (
                        <motion.div
                          layoutId="active-dot"
                          className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"
                        />
                      )}
                      <h3
                        className={`text-base transition-colors duration-200 ${
                          isActive
                            ? "text-white font-semibold"
                            : "text-[#555] group-hover:text-[#888]"
                        }`}
                      >
                        {f.title}
                      </h3>
                    </div>
                  </button>
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="pb-5 pl-[18px] space-y-2">
                          <p className="text-sm text-[#888] leading-relaxed">
                            {f.description}
                          </p>
                          <p className="text-xs text-primary cursor-pointer hover:underline">
                            {f.learnMore}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* Right — Mockup area */}
          <div className="rounded-2xl bg-[#111] border border-[#222] p-6 min-h-[340px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <ActiveMockup />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────
   PART B — Bento grid
   ────────────────────────────────────────── */

function BentoCard({
  children,
  title,
  description,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
  className?: string;
  delay?: number;
}) {
  return (
    <ScaleIn delay={delay} className={className}>
      <div className="h-full bg-[#111] border border-[#222] rounded-2xl overflow-hidden hover:border-[#333] transition-colors">
        <div className="p-6 pb-4">{children}</div>
        <div className="p-6 pt-0">
          <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
          <p className="text-xs text-[#888] leading-relaxed">{description}</p>
        </div>
      </div>
    </ScaleIn>
  );
}

/* ── Bento visuals ── */
function BentoHookBodyCta() {
  const bars = [
    { label: "Hook", fill: 70 },
    { label: "Body", fill: 60 },
    { label: "CTA", fill: 75 },
  ];
  return (
    <div className="space-y-3">
      {bars.map((b) => (
        <div key={b.label} className="space-y-1">
          <div className="flex justify-between">
            <span className="text-[10px] text-[#555] font-mono uppercase">{b.label}</span>
            <span className="text-[10px] text-[#555] font-mono">{b.fill}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#1a1a1a] overflow-hidden">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${b.fill}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function BentoVariations() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {["01", "02", "03", "04"].map((n) => (
        <div
          key={n}
          className="aspect-video rounded-lg bg-[#1a1a1a] border border-[#222] flex items-center justify-center"
        >
          <span className="text-[10px] font-mono text-[#444]">{n}</span>
        </div>
      ))}
    </div>
  );
}

function BentoBrandSummary() {
  const lines = [
    "Tone: Bold & Playful",
    "Target: 25-34F",
    "USP: Clinically tested",
  ];
  return (
    <div className="rounded-xl bg-[#0e0e0e] border border-[#1a1a1a] p-3 space-y-2 font-mono">
      {lines.map((line) => (
        <p key={line} className="text-[11px] text-[#888]">
          {line}
          <span className="inline-block w-[2px] h-3 bg-primary/60 ml-0.5 animate-pulse align-middle" />
        </p>
      ))}
    </div>
  );
}

function BentoLipSync() {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1 text-center rounded-xl bg-[#0e0e0e] border border-[#1a1a1a] py-4">
        <p className="text-xs text-red-500/70 font-medium">Long video</p>
        <p className="text-[10px] text-[#444] mt-0.5">Degraded sync</p>
      </div>
      <div className="w-px h-12 bg-[#222]" />
      <div className="flex-1 text-center rounded-xl bg-[#0e0e0e] border border-primary/20 py-4">
        <p className="text-xs text-primary font-medium">Short segments</p>
        <p className="text-[10px] text-[#555] mt-0.5">Crisp lip-sync</p>
      </div>
    </div>
  );
}

function BentoPlatforms() {
  return (
    <div className="flex items-center justify-center gap-2">
      {["TikTok", "Meta", "YouTube"].map((p) => (
        <span
          key={p}
          className="px-3 py-1.5 rounded-full bg-[#1a1a1a] border border-[#222] text-[11px] text-[#888] font-medium"
        >
          {p}
        </span>
      ))}
    </div>
  );
}

function BentoPersistentPersona() {
  return (
    <div className="flex items-center justify-center gap-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="w-16 h-20 rounded-lg bg-[#1a1a1a] border border-[#222] flex flex-col items-center justify-center gap-1"
        >
          <div className="w-7 h-7 rounded-full bg-[#222] flex items-center justify-center">
            <span className="text-[8px] font-bold text-[#555]">CR</span>
          </div>
          <div className="w-8 h-0.5 rounded bg-[#222]" />
        </div>
      ))}
    </div>
  );
}

function BentoGrid() {
  return (
    <section className="bg-[#0A0A0A] pb-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Row 1 */}
          <BentoCard
            className="md:col-span-2"
            title="Hook/Body/CTA Structure"
            description="Optimized for paid social conversion. Every video follows the structure that performs."
            delay={0}
          >
            <BentoHookBodyCta />
          </BentoCard>
          <BentoCard
            className="md:col-span-1"
            title="4 Variations Per Batch"
            description="Hedge against AI artifacts. Pick the best, discard the rest."
            delay={0.1}
          >
            <BentoVariations />
          </BentoCard>

          {/* Row 2 */}
          <BentoCard
            className="md:col-span-1"
            title="AI Brand Summary"
            description="AI analyzes your store and generates brand intelligence automatically."
            delay={0.2}
          >
            <BentoBrandSummary />
          </BentoCard>
          <BentoCard
            className="md:col-span-2"
            title="Zero Lip-Sync Degradation"
            description="Segments under 10 seconds each. Crisp lip-sync. Professional quality."
            delay={0.3}
          >
            <BentoLipSync />
          </BentoCard>

          {/* Row 3 */}
          <BentoCard
            className="md:col-span-1"
            title="Every Major Platform"
            description="9:16 vertical format. MP4 download. Upload anywhere."
            delay={0.4}
          >
            <BentoPlatforms />
          </BentoCard>
          <BentoCard
            className="md:col-span-1"
            title="Persistent AI Persona"
            description="Build once. Use across every product, every campaign."
            delay={0.5}
          >
            <BentoPersistentPersona />
          </BentoCard>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────
   Export
   ────────────────────────────────────────── */

export function FeaturesSection() {
  return (
    <>
      <FeatureShowcase />
      <BentoGrid />
    </>
  );
}
