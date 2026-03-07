"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, ExternalLink } from "lucide-react";
import { FadeInUp } from "@/lib/motion";

// Traditional UGC avg: ~$200/video. Source: billo.app/blog/ugc-rates
const TRADITIONAL_COST_PER_VIDEO = 200;
const TRADITIONAL_SOURCE_URL = "https://billo.app/blog/ugc-rates/";
const MAX_PER_TYPE = 9;

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={value}
        initial={{ y: -18, opacity: 0, scale: 0.8 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 18, opacity: 0, scale: 0.8 }}
        transition={{ type: "spring", stiffness: 420, damping: 24, duration: 0.2 }}
        className={className}
      >
        {value}
      </motion.span>
    </AnimatePresence>
  );
}

function BigStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(1, value - 1))}
          disabled={value <= 1}
          className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-foreground transition-all duration-150 disabled:opacity-20 disabled:cursor-not-allowed shrink-0"
        >
          <Minus className="size-3" />
        </button>
        <div className="w-14 sm:w-16 flex justify-center">
          <AnimatedNumber
            value={value}
            className="text-6xl sm:text-7xl font-bold text-foreground tabular-nums leading-none"
          />
        </div>
        <button
          onClick={() => onChange(Math.min(MAX_PER_TYPE, value + 1))}
          disabled={value >= MAX_PER_TYPE}
          className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-foreground transition-all duration-150 disabled:opacity-20 disabled:cursor-not-allowed shrink-0"
        >
          <Plus className="size-3" />
        </button>
      </div>
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-medium">{label}</p>
    </div>
  );
}

export function CombinationCalculatorSection() {
  const [hooks, setHooks] = useState(3);
  const [bodies, setBodies] = useState(3);
  const [ctas, setCtas] = useState(3);

  const totalCombos = hooks * bodies * ctas;
  // Generation cost: each segment = $1/credit (standard rate)
  const generationCost = hooks + bodies + ctas;
  const costPerVideo = generationCost / totalCombos;
  const traditionalTotal = totalCombos * TRADITIONAL_COST_PER_VIDEO;
  const savings = traditionalTotal - generationCost;

  return (
    <section className="bg-background py-20 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">

        <FadeInUp className="text-center mb-14">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3">
            Combination Engine
          </p>
          <h2 className="text-[clamp(2rem,4vw,3rem)] font-semibold tracking-tight text-foreground">
            One generation.{" "}
            <span className="font-serif italic text-primary">infinite combinations.</span>
          </h2>
          <p className="text-muted-foreground mt-3 text-base max-w-lg mx-auto">
            Generate your Hooks, Bodies, and CTAs once. CineRads automatically builds every
            unique ad combination with its algorithm. No extra credits ever.
          </p>
        </FadeInUp>

        {/* Big equation row */}
        <FadeInUp delay={0.1}>
          <div className="flex items-center justify-center gap-3 sm:gap-5 flex-wrap mb-3">
            <BigStepper label="Hooks" value={hooks} onChange={setHooks} />

            <span className="text-3xl text-muted-foreground/30 font-light mt-[-18px]">×</span>

            <BigStepper label="Bodies" value={bodies} onChange={setBodies} />

            <span className="text-3xl text-muted-foreground/30 font-light mt-[-18px]">×</span>

            <BigStepper label="CTAs" value={ctas} onChange={setCtas} />

            <span className="text-3xl text-muted-foreground/30 font-light mt-[-18px]">=</span>

            {/* Result */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-24 sm:w-28 flex justify-center">
                <AnimatedNumber
                  value={totalCombos}
                  className="text-6xl sm:text-7xl font-bold text-primary tabular-nums leading-none"
                />
              </div>
              <p className="text-xs uppercase tracking-[0.14em] text-primary font-medium">Unique Ads</p>
            </div>
          </div>
        </FadeInUp>

        {/* Compact stat row */}
        <FadeInUp delay={0.18}>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-10 text-sm">
            <span className="text-muted-foreground">
              Your cost per ad:{" "}
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={costPerVideo.toFixed(2)}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.15 }}
                  className="inline-block font-semibold text-primary tabular-nums"
                >
                  ${costPerVideo.toFixed(2)}
                </motion.span>
              </AnimatePresence>
            </span>

            <span className="text-border">·</span>

            <span className="text-muted-foreground">
              Traditional total:{" "}
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={traditionalTotal}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.15 }}
                  className="inline-block font-semibold text-foreground tabular-nums"
                >
                  ${traditionalTotal.toLocaleString()}
                </motion.span>
              </AnimatePresence>
              <a
                href={TRADITIONAL_SOURCE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 ml-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors text-xs"
              >
                ~$200/video <ExternalLink className="size-2.5" />
              </a>
            </span>

            <span className="text-border">·</span>

            <span className="text-muted-foreground">
              You save:{" "}
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={savings}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.15 }}
                  className="inline-block font-semibold text-green-500 tabular-nums"
                >
                  ${savings.toLocaleString()}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>
        </FadeInUp>

      </div>
    </section>
  );
}
