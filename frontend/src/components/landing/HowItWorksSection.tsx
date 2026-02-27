"use client";

import { Link, Upload, Clapperboard } from "lucide-react";
import { FadeInUp, StaggerContainer, staggerItem } from "@/lib/motion";
import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    icon: Link,
    title: "Paste URL",
    description:
      "Drop any product or store URL. We import everything — name, images, price, description — in seconds.",
  },
  {
    number: "02",
    icon: Upload,
    title: "Build Persona",
    description:
      "Define your AI spokesperson with 9 brand attributes. Tone, energy, style — saved and reused forever.",
  },
  {
    number: "03",
    icon: Clapperboard,
    title: "Generate & Mix",
    description:
      "AI writes Hook/Body/CTA scripts and generates video. Mix 3 segments into 27 unique combinations. Download MP4s.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="bg-[#050505] py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        {/* Heading */}
        <FadeInUp className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.15em] text-[#555] mb-3">Process</p>
          <h2 className="text-[clamp(2rem,4vw,3rem)] font-semibold tracking-tight text-white">
            How It Works
          </h2>
        </FadeInUp>

        {/* Steps */}
        <StaggerContainer className="relative grid md:grid-cols-3 gap-0" staggerDelay={0.15}>
          {steps.map((step, i) => (
            <motion.div key={step.number} variants={staggerItem} className="relative">
              {/* Connecting dashed line between steps (desktop) */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-5 left-[60%] w-[80%] border-t border-dashed border-[#2a2a2a] z-0" />
              )}

              <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left px-6 py-8">
                {/* Step number circle */}
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-primary/30 mb-5">
                  <span className="text-primary font-mono text-xs font-bold">{step.number}</span>
                </div>

                {/* Icon */}
                <step.icon className="size-6 text-[#555] mb-4" strokeWidth={1.5} />

                <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-[#888] leading-relaxed">{step.description}</p>
              </div>

              {/* Mobile connecting line */}
              {i < steps.length - 1 && (
                <div className="md:hidden mx-auto w-px h-8 border-l border-dashed border-[#2a2a2a]" />
              )}
            </motion.div>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
