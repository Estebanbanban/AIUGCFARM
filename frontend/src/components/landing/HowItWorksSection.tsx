"use client";

import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/lib/animations";
import { Link, Sparkles, Film, ArrowRight, ShoppingBag, User, Clapperboard } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Link,
    title: "Paste Your URL",
    description:
      "Import your products automatically from any store. Zero data entry required.",
  },
  {
    number: "02",
    icon: Sparkles,
    title: "Build Your Persona",
    description:
      "Create your AI spokesperson with our character builder. 9 configurable attributes.",
  },
  {
    number: "03",
    icon: Film,
    title: "Generate & Download",
    description:
      "AI generates Hook/Body/CTA segments. Mix, match, download MP4. Ready for TikTok & Meta.",
  },
];

function StepMiniVisual({ stepNumber }: { stepNumber: string }) {
  if (stepNumber === "01") {
    return (
      <div className="mt-6 mx-auto max-w-[220px] rounded-xl border border-border bg-zinc-900/60 p-3 space-y-2">
        <div className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-2 py-1.5 text-[10px] text-muted-foreground">
          <Link className="size-3 text-primary/60 shrink-0" />
          <span className="truncate">mystore.com/product</span>
        </div>
        <div className="flex items-center gap-1 justify-center py-1">
          <ArrowRight className="size-3 text-primary animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-md bg-zinc-800/80 p-2 flex flex-col items-center gap-1">
              <ShoppingBag className="size-3.5 text-primary/40" />
              <div className="w-full h-1 rounded bg-zinc-700" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (stepNumber === "02") {
    return (
      <div className="mt-6 mx-auto max-w-[220px] rounded-xl border border-border bg-zinc-900/60 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
            <User className="size-4 text-primary" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="h-1.5 rounded bg-primary/30 w-3/4" />
            <div className="h-1.5 rounded bg-zinc-700 w-1/2" />
          </div>
        </div>
        {[70, 50, 85].map((w, i) => (
          <div key={i} className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary/20" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="mt-6 mx-auto max-w-[220px] rounded-xl border border-border bg-zinc-900/60 p-3 space-y-2">
      <div className="flex items-center gap-1.5 mb-1">
        <Clapperboard className="size-3 text-primary" />
        <span className="text-[9px] font-medium text-muted-foreground">3 Segments Ready</span>
      </div>
      <div className="flex gap-1">
        {["Hook", "Body", "CTA"].map((seg) => (
          <div key={seg} className="flex-1 rounded-md bg-primary/10 border border-primary/20 py-1.5 text-center">
            <p className="text-[8px] font-medium text-primary">{seg}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-1 pt-0.5">
        <div className="size-1 rounded-full bg-green-500" />
        <span className="text-[9px] text-green-400">Ready to export</span>
      </div>
    </div>
  );
}

export function HowItWorksSection() {
  return (
    <section id="features" className="py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          {...fadeInUp}
          whileInView={fadeInUp.animate}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
            How It Works
          </p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            From URL to Video Ad in 3 Steps
          </h2>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12"
        >
          {/* Dotted line connector (desktop) */}
          <div className="hidden md:block absolute top-16 left-[20%] right-[20%] border-t-2 border-dashed border-border" />

          {steps.map((step) => (
            <motion.div
              key={step.number}
              variants={fadeInUp}
              className="relative text-center"
            >
              <div className="relative z-10 mx-auto mb-6 flex size-14 items-center justify-center rounded-xl bg-primary/10">
                <step.icon className="size-6 text-primary" />
              </div>
              <span className="font-mono text-sm font-bold text-primary mb-2 block">
                {step.number}
              </span>
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
                {step.description}
              </p>
              <StepMiniVisual stepNumber={step.number} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
