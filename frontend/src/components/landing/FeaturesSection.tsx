"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useScroll, useMotionValueEvent, useSpring } from "framer-motion";
import { FadeInUp, ScaleIn } from "@/lib/motion";
import Image from "next/image";

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

const featureMedia: Record<
  FeatureId,
  {
    type: "image";
    src: string;
    alt: string;
  }
> = {
  import: {
    type: "image",
    src: "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=max&w=1400&q=80",
    alt: "Ecommerce storefront with product catalog",
  },
  persona: {
    type: "image",
    src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=max&w=1400&q=80",
    alt: "Creator portrait for AI persona",
  },
  generate: {
    type: "image",
    src: "https://images.unsplash.com/photo-1492619375914-88005aa9e8fb?auto=format&fit=max&w=1400&q=80",
    alt: "AI generated ad video timeline",
  },
  mixer: {
    type: "image",
    src: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=max&w=1400&q=80",
    alt: "Multiple ad variations preview",
  },
};

const personaHeaderMedia: Record<string, string> = {
  Alex: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=max&w=1400&q=80",
  Maya: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=max&w=1400&q=80",
  Jordan: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=max&w=1400&q=80",
  Riley: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=max&w=1400&q=80",
};

/* ── Mockup: Import — full product import UI ── */
function MockImport() {
  const products = [
    {
      name: "Hydra Serum",
      price: "$45",
      tag: "Bestseller",
      image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=max&w=1200&q=80",
      accent: "from-amber-500/25 via-amber-300/10 to-transparent",
    },
    {
      name: "Cloud Runner Pro",
      price: "$129",
      tag: "New",
      image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=max&w=1200&q=80",
      accent: "from-blue-500/25 via-blue-300/10 to-transparent",
    },
    {
      name: "Vital Blend",
      price: "$39",
      tag: "Popular",
      image: "https://images.unsplash.com/photo-1552046122-03184de85e08?auto=format&fit=max&w=1200&q=80",
      accent: "from-emerald-500/25 via-emerald-300/10 to-transparent",
    },
    {
      name: "Luna Ring",
      price: "$89",
      tag: "Limited",
      image: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=max&w=1200&q=80",
      accent: "from-slate-500/25 via-slate-300/10 to-transparent",
    },
  ];
  return (
    <div className="flex flex-col h-full gap-4">
      {/* URL bar */}
      <div className="flex items-center gap-2 rounded-lg bg-[#0d1016] border border-white/10 px-3 py-2">
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <span className="text-xs text-[#7b8291] font-mono truncate">shopify.com/collections/all</span>
        <span className="ml-auto text-[10px] text-primary font-medium shrink-0">Scanning...</span>
      </div>
      {/* Product grid */}
      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0 auto-rows-fr">
        {products.map((p, i) => (
          <motion.div
            key={p.name}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.12, duration: 0.45, ease: [0.25, 0.4, 0.25, 1] }}
            className="h-full rounded-xl border border-white/10 bg-[#11151d] p-2 flex flex-col gap-2 overflow-hidden"
          >
            <div className="relative h-24 rounded-lg overflow-hidden bg-[#0f1116]">
              <Image
                src={p.image}
                alt={p.name}
                fill
                className="object-contain p-1"
                sizes="(max-width: 1024px) 50vw, 20vw"
              />
              <div className={`absolute inset-0 bg-gradient-to-t ${p.accent} opacity-60`} />
            </div>
            <div className="px-0.5">
              <p className="text-xs font-semibold text-white leading-none">{p.name}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[11px] text-[#b2b9c6]">{p.price}</p>
                <span className="text-[9px] bg-white/10 text-[#e2e8f6] rounded px-1.5 py-0.5">{p.tag}</span>
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
        className="rounded-xl bg-[#0d1016] border border-white/10 p-3"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <p className="text-[10px] uppercase tracking-wider text-[#7b8291] font-mono">AI Brand Profile Generated</p>
        </div>
        <p className="text-xs text-[#c8cdda] leading-relaxed">Premium skincare & lifestyle brand. Target: women 25-34. Tone: confident, clean, aspirational.</p>
      </motion.div>
    </div>
  );
}

/* ── Mockup: Persona — full builder UI ── */
function MockPersona({ onPersonaChange }: { onPersonaChange?: (name: string) => void }) {
  const personas = [
    {
      name: "Alex",
      attrs: [
        { name: "Tone", label: "Bold & Confident", fill: 78 },
        { name: "Energy", label: "Upbeat", fill: 62 },
        { name: "Style", label: "Minimal", fill: 85 },
        { name: "Age Range", label: "25-34", fill: 55 },
        { name: "Authenticity", label: "Very High", fill: 90 },
      ],
    },
    {
      name: "Maya",
      attrs: [
        { name: "Tone", label: "Warm & Friendly", fill: 72 },
        { name: "Energy", label: "Calm", fill: 48 },
        { name: "Style", label: "Lifestyle", fill: 69 },
        { name: "Age Range", label: "22-30", fill: 43 },
        { name: "Authenticity", label: "High", fill: 84 },
      ],
    },
    {
      name: "Jordan",
      attrs: [
        { name: "Tone", label: "Direct & Clear", fill: 66 },
        { name: "Energy", label: "Balanced", fill: 58 },
        { name: "Style", label: "Educational", fill: 74 },
        { name: "Age Range", label: "28-38", fill: 63 },
        { name: "Authenticity", label: "Very High", fill: 88 },
      ],
    },
    {
      name: "Riley",
      attrs: [
        { name: "Tone", label: "Playful", fill: 70 },
        { name: "Energy", label: "High", fill: 81 },
        { name: "Style", label: "Trendy", fill: 77 },
        { name: "Age Range", label: "20-28", fill: 36 },
        { name: "Authenticity", label: "High", fill: 79 },
      ],
    },
  ] as const;
  const [selectedPersona, setSelectedPersona] = useState(0);
  const activePersona = personas[selectedPersona];
  useEffect(() => {
    onPersonaChange?.(activePersona.name);
  }, [activePersona.name, onPersonaChange]);

  return (
    <div className="flex flex-col h-full gap-5">
      {/* Persona selector */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#444] mb-2.5 font-mono">Choose Spokesperson</p>
        <div className="grid grid-cols-4 gap-2">
          {personas.map((name, i) => (
            <button
              key={name.name}
              type="button"
              onClick={() => {
                setSelectedPersona(i);
                onPersonaChange?.(name.name);
              }}
              className={`rounded-xl border p-3 flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                i === selectedPersona ? "border-primary/50 bg-primary/8" : "border-[#1f1f1f] bg-[#0e0e0e]"
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                i === selectedPersona ? "bg-primary/20 text-primary" : "bg-[#1a1a1a] text-[#444]"
              }`}>
                {name.name[0]}
              </div>
              <p className={`text-[9px] ${i === selectedPersona ? "text-white" : "text-[#555]"}`}>{name.name}</p>
            </button>
          ))}
        </div>
      </div>
      {/* Attributes */}
      <div className="flex-1 space-y-3.5">
        <p className="text-[10px] uppercase tracking-widest text-[#444] font-mono">Brand Attributes</p>
        {activePersona.attrs.map((a, i) => (
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
        <p className="text-xs text-primary font-medium">{activePersona.name} persona saved · used across 12 campaigns</p>
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

type MockupProps = {
  onPersonaChange?: (name: string) => void;
};

const mockups: Record<FeatureId, (props: MockupProps) => React.ReactElement> = {
  import: () => <MockImport />,
  persona: (props) => <MockPersona onPersonaChange={props.onPersonaChange} />,
  generate: () => <MockGenerate />,
  mixer: () => <MockMixer />,
};

function FeatureShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedPersonaName, setSelectedPersonaName] = useState("Alex");
  const containerRef = useRef<HTMLDivElement>(null);

  // Track scroll through the tall container → map to active feature
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Smooth the scroll signal first to avoid abrupt feature jumps.
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 28,
    mass: 0.35,
  });

  useMotionValueEvent(smoothProgress, "change", (v) => {
    const idx = Math.max(0, Math.min(features.length - 1, Math.round(v * (features.length - 1))));
    setActiveIndex((prev) => (prev === idx ? prev : idx));
  });

  const active = features[activeIndex];
  const ActiveMockup = mockups[active.id];
  const activeMedia =
    active.id === "persona"
      ? { ...featureMedia.persona, src: personaHeaderMedia[selectedPersonaName] ?? featureMedia.persona.src }
      : featureMedia[active.id];

  return (
    // Tall outer container: 100vh per feature so scroll drives transitions
    <div
      ref={containerRef}
      className="relative bg-[#000]"
      style={{ height: `${features.length * 100}vh` }}
    >
      {/* Sticky panel — stays in view while user scrolls */}
      <div className="sticky top-0 h-screen flex items-center overflow-visible">
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
                      <div className="mt-1.5 h-14 w-0.5 shrink-0 rounded-full overflow-hidden bg-[#1a1a1a]">
                        <motion.div
                          className="w-full bg-primary rounded-full"
                          initial={false}
                          animate={{ scaleY: isActive ? 1 : 0.25, opacity: isActive ? 1 : 0.55 }}
                          style={{ height: "100%", originY: 0 }}
                          transition={{ type: "spring", stiffness: 220, damping: 28, mass: 0.3 }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium transition-colors duration-200 ${
                          isActive ? "text-white" : "text-[#444] group-hover:text-[#777]"
                        }`}>
                          {f.title}
                        </p>
                        <motion.div
                          initial={false}
                          animate={{ height: isActive ? "auto" : 0, opacity: isActive ? 1 : 0, y: isActive ? 0 : -4 }}
                          transition={{
                            height: { duration: 0.45, ease: [0.25, 0.4, 0.25, 1] },
                            opacity: { duration: 0.3, ease: "easeOut" },
                            y: { duration: 0.28, ease: "easeOut" },
                          }}
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
              <div className="relative w-full h-48 rounded-xl overflow-hidden border border-[#1f1f1f] mb-5 bg-[#0b0b0b]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${active.id}-media`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="h-full w-full"
                  >
                    {active.id === "persona" ? (
                      <div className="h-full w-full grid grid-cols-[11rem_1fr] gap-3 p-3">
                        <div className="relative h-full rounded-lg overflow-hidden border border-white/10">
                          <Image
                            src={activeMedia.src}
                            alt={activeMedia.alt}
                            fill
                            className="object-cover object-center"
                            sizes="15vw"
                          />
                        </div>
                        <div className="rounded-lg border border-white/10 bg-gradient-to-br from-[#12161f] to-[#0d1016] flex flex-col justify-center px-4">
                          <p className="text-[10px] uppercase tracking-widest text-[#647089] font-mono mb-1">Selected Persona</p>
                          <p className="text-xl font-semibold text-white">{selectedPersonaName}</p>
                          <p className="text-xs text-[#9ea7b8] mt-1">Live preview updates when user selects another spokesperson.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full w-full p-1">
                        <Image
                          src={activeMedia.src}
                          alt={activeMedia.alt}
                          fill
                          className="object-contain"
                          sizes="40vw"
                        />
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIndex}
                  className="h-[calc(100%-9rem)]"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
                >
                  <ActiveMockup onPersonaChange={setSelectedPersonaName} />
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
    <section className="bg-[#0A0A0A] pt-20 sm:pt-24 lg:pt-28 pb-24 px-4 sm:px-6">
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
