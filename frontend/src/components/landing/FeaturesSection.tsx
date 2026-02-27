"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
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

/* ── Mockup: Import — full product import UI ── */
function MockImport() {
  const products = [
    { name: "Hydra Serum", price: "$45", tag: "Bestseller", color: "from-amber-950/60 to-amber-900/30" },
    { name: "Cloud Runner Pro", price: "$129", tag: "New", color: "from-blue-950/60 to-blue-900/30" },
    { name: "Vital Blend", price: "$39", tag: "Popular", color: "from-green-950/60 to-green-900/30" },
    { name: "Luna Ring", price: "$89", tag: "Limited", color: "from-stone-900/60 to-stone-800/30" },
  ];
  return (
    <div className="flex flex-col h-full gap-4">
      {/* URL bar */}
      <div className="flex items-center gap-2 rounded-lg bg-[#0e0e0e] border border-[#1f1f1f] px-3 py-2">
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <span className="text-xs text-[#555] font-mono truncate">shopify.com/collections/all</span>
        <span className="ml-auto text-[10px] text-primary font-medium shrink-0">Scanning…</span>
      </div>
      {/* Product grid */}
      <div className="grid grid-cols-2 gap-3 flex-1">
        {products.map((p, i) => (
          <motion.div
            key={p.name}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.12, duration: 0.45, ease: [0.25, 0.4, 0.25, 1] }}
            className={`rounded-xl bg-gradient-to-br ${p.color} border border-[#1f1f1f] p-3 flex flex-col gap-2`}
          >
            <div className="aspect-square rounded-lg bg-[#1a1a1a] flex items-center justify-center">
              <div className="w-8 h-8 rounded bg-[#252525]" />
            </div>
            <div>
              <p className="text-xs font-medium text-white leading-none">{p.name}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] text-[#666]">{p.price}</p>
                <span className="text-[9px] bg-primary/15 text-primary rounded px-1.5 py-0.5">{p.tag}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      {/* Brand summary */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="rounded-xl bg-[#0e0e0e] border border-[#1f1f1f] p-3"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <p className="text-[10px] uppercase tracking-wider text-[#555] font-mono">AI Brand Profile Generated</p>
        </div>
        <p className="text-xs text-[#777] leading-relaxed">Premium skincare & lifestyle brand. Target: women 25–34. Tone: confident, clean, aspirational.</p>
      </motion.div>
    </div>
  );
}

/* ── Mockup: Persona — full builder UI ── */
function MockPersona() {
  const attrs = [
    { name: "Tone", label: "Bold & Confident", fill: 78 },
    { name: "Energy", label: "Upbeat", fill: 62 },
    { name: "Style", label: "Minimal", fill: 85 },
    { name: "Age Range", label: "25–34", fill: 55 },
    { name: "Authenticity", label: "Very High", fill: 90 },
  ];
  const personas = ["Alex", "Maya", "Jordan", "Riley"];
  return (
    <div className="flex flex-col h-full gap-5">
      {/* Persona selector */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#444] mb-2.5 font-mono">Choose Spokesperson</p>
        <div className="grid grid-cols-4 gap-2">
          {personas.map((name, i) => (
            <div
              key={name}
              className={`rounded-xl border p-3 flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                i === 0 ? "border-primary/50 bg-primary/8" : "border-[#1f1f1f] bg-[#0e0e0e]"
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                i === 0 ? "bg-primary/20 text-primary" : "bg-[#1a1a1a] text-[#444]"
              }`}>
                {name[0]}
              </div>
              <p className={`text-[9px] ${i === 0 ? "text-white" : "text-[#555]"}`}>{name}</p>
            </div>
          ))}
        </div>
      </div>
      {/* Attributes */}
      <div className="flex-1 space-y-3.5">
        <p className="text-[10px] uppercase tracking-widest text-[#444] font-mono">Brand Attributes</p>
        {attrs.map((a, i) => (
          <div key={a.name} className="space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-[#888]">{a.name}</span>
              <span className="text-[10px] text-[#555]">{a.label}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${a.fill}%` }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.7, ease: "easeOut" }}
                className="h-full rounded-full bg-primary"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-[#0e0e0e] border border-primary/20 px-4 py-3 text-center">
        <p className="text-xs text-primary font-medium">Persona saved · used across 12 campaigns</p>
      </div>
    </div>
  );
}

/* ── Mockup: Generate — script + video output ── */
function MockGenerate() {
  const segments = [
    {
      label: "HOOK",
      duration: "4s",
      border: "border-primary/60",
      glow: "shadow-[0_0_20px_rgba(249,115,22,0.08)]",
      text: "Stop scrolling. This changed my skin in 7 days.",
      bg: "from-amber-950/30 to-transparent",
    },
    {
      label: "BODY",
      duration: "8s",
      border: "border-[#2a2a2a]",
      glow: "",
      text: "Hydra Serum uses clinically-tested peptides that actually penetrate 3 layers deep.",
      bg: "from-blue-950/20 to-transparent",
    },
    {
      label: "CTA",
      duration: "3s",
      border: "border-[#2a2a2a]",
      glow: "",
      text: "Tap below and try it risk-free for 30 days.",
      bg: "from-green-950/20 to-transparent",
    },
  ];
  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-[#444] font-mono">Script Generated</p>
        <span className="text-[10px] text-primary bg-primary/10 rounded-full px-2.5 py-1">Hydra Serum · Alex</span>
      </div>
      <div className="flex-1 space-y-3">
        {segments.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.18, duration: 0.45, ease: [0.25, 0.4, 0.25, 1] }}
            className={`rounded-xl bg-gradient-to-r ${s.bg} border ${s.border} ${s.glow} p-4`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] uppercase tracking-widest font-mono text-[#555]">{s.label}</span>
              <span className="text-[9px] text-[#444] font-mono">{s.duration}</span>
            </div>
            <p className="text-sm text-[#ccc] leading-relaxed">{s.text}</p>
          </motion.div>
        ))}
      </div>
      {/* Generation progress */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="rounded-xl bg-[#0e0e0e] border border-[#1f1f1f] p-3"
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-[#666]">Generating video clips…</p>
          <p className="text-[10px] text-primary font-mono">3 / 3</p>
        </div>
        <div className="h-1 rounded-full bg-[#1a1a1a] overflow-hidden">
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ delay: 0.8, duration: 1.5, ease: "easeInOut" }}
            className="h-full bg-primary rounded-full"
          />
        </div>
      </motion.div>
    </div>
  );
}

/* ── Mockup: Mixer — combination matrix ── */
function MockMixer() {
  const cols = [
    { title: "Hook", items: ["\"Stop scrolling—\"", "\"POV: you found\"", "\"This is why I—\""] },
    { title: "Body", items: ["7-day skin change", "Clinically tested", "Dermatologist pick"] },
    { title: "CTA", items: ["Try risk-free →", "Shop now →", "Get 20% off →"] },
  ];
  const selected = [0, 1, 0];
  return (
    <div className="flex flex-col h-full gap-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-[#444] font-mono">Segment Mixer</p>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[#555] font-mono">3 × 3 × 3 =</span>
          <span className="text-sm font-bold text-primary">27</span>
          <span className="text-[10px] text-[#555]">combos</span>
        </div>
      </div>
      {/* 3-column grid */}
      <div className="grid grid-cols-3 gap-3 flex-1">
        {cols.map((col, ci) => (
          <div key={col.title} className="flex flex-col gap-2">
            <p className="text-[9px] uppercase tracking-widest text-[#444] font-mono text-center">{col.title}</p>
            {col.items.map((item, j) => (
              <div
                key={item}
                className={`rounded-lg border p-2.5 text-center text-[10px] leading-tight transition-all ${
                  j === selected[ci]
                    ? "border-primary/50 bg-primary/10 text-primary font-medium shadow-[0_0_12px_rgba(249,115,22,0.1)]"
                    : "border-[#1f1f1f] bg-[#0d0d0d] text-[#555]"
                }`}
              >
                {item}
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* Selected combo preview */}
      <div className="rounded-xl bg-[#0e0e0e] border border-[#1f1f1f] p-3 space-y-1.5">
        <p className="text-[9px] uppercase tracking-widest text-[#444] font-mono">Active Combination</p>
        <div className="flex items-center gap-2 flex-wrap">
          {["\"Stop scrolling—\"", "Clinically tested", "Try risk-free →"].map((item, i) => (
            <span key={i} className="text-[10px] bg-[#1a1a1a] border border-[#252525] rounded px-2 py-1 text-[#888]">
              {item}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <div className="flex-1 h-0.5 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div className="h-full w-full bg-primary rounded-full" />
          </div>
          <span className="text-[9px] text-primary font-medium shrink-0">Ready to export</span>
        </div>
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
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track scroll through the tall container → map to active feature
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const idx = Math.min(features.length - 1, Math.floor(v * features.length));
    setActiveIndex(idx);
  });

  const active = features[activeIndex];
  const ActiveMockup = mockups[active.id];

  return (
    // Tall outer container: 100vh per feature so scroll drives transitions
    <div
      ref={containerRef}
      className="relative bg-[#000]"
      style={{ height: `${features.length * 100}vh` }}
    >
      {/* Sticky panel — stays in view while user scrolls */}
      <div className="sticky top-0 h-screen flex items-center overflow-hidden">
        {/* Full-bleed layout: sidebar left, big visual right */}
        <div className="w-full flex h-full">

          {/* ── LEFT SIDEBAR ── narrow, centered vertically */}
          <div className="flex flex-col justify-center px-8 sm:px-12 lg:px-16 w-full lg:w-[380px] shrink-0 border-r border-[#111]">
            {/* Label */}
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#444] mb-8 font-mono">Features</p>

            {/* Feature list — Framer style */}
            <nav className="space-y-0">
              {features.map((f, i) => {
                const isActive = i === activeIndex;
                return (
                  <button
                    key={f.id}
                    onClick={() => setActiveIndex(i)}
                    className="group w-full text-left border-b border-[#111] last:border-b-0 py-5"
                  >
                    <div className="flex items-start gap-3">
                      {/* Active indicator bar */}
                      <div className="mt-1.5 w-0.5 shrink-0 rounded-full overflow-hidden bg-[#1a1a1a]" style={{ height: isActive ? "auto" : "14px" }}>
                        <motion.div
                          className="w-full bg-primary rounded-full"
                          animate={{ height: isActive ? "100%" : "14px" }}
                          style={{ height: "14px" }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium transition-colors duration-200 ${
                          isActive ? "text-white" : "text-[#444] group-hover:text-[#777]"
                        }`}>
                          {f.title}
                        </p>
                        <AnimatePresence>
                          {isActive && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
                              className="overflow-hidden"
                            >
                              <p className="text-sm text-[#666] leading-relaxed mt-2">
                                {f.description}
                              </p>
                              <p className="text-xs text-[#555] mt-1.5 leading-relaxed">
                                {f.learnMore}
                              </p>
                              <p className="text-xs text-primary mt-3 hover:underline cursor-pointer inline-block">
                                Learn more →
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* Scroll progress dots */}
            <div className="flex gap-1.5 mt-10">
              {features.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  className={`h-0.5 rounded-full transition-all duration-300 ${
                    i === activeIndex ? "bg-primary w-5" : "bg-[#222] w-2.5"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* ── RIGHT PANEL ── large mockup, takes remaining space */}
          <div className="hidden lg:flex flex-1 items-center justify-center p-10 bg-[#040404]">
            <div className="w-full max-w-xl h-full max-h-[580px] rounded-2xl bg-[#0d0d0d] border border-[#1a1a1a] p-7 shadow-[0_0_80px_rgba(0,0,0,0.6)]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIndex}
                  className="h-full"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
                >
                  <ActiveMockup />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

        </div>
      </div>
    </div>
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
