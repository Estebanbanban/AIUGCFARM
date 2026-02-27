"use client";

import { Link, Upload, Clapperboard } from "lucide-react";
import { FadeInUp, StaggerContainer, staggerItem } from "@/lib/motion";
import { motion } from "framer-motion";
import Image from "next/image";

const steps = [
  {
    number: "01",
    icon: Link,
    title: "Paste URL",
    description:
      "Drop any product or store URL. We import everything — name, images, price, description — in seconds.",
    mediaType: "image" as const,
    mediaSrc:
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1200&q=80",
    mediaAlt: "Online fashion store products",
  },
  {
    number: "02",
    icon: Upload,
    title: "Build Persona",
    description:
      "Define your AI spokesperson with 9 brand attributes. Tone, energy, style — saved and reused forever.",
    mediaType: "image" as const,
    mediaSrc:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80",
    mediaAlt: "Creator portrait for persona generation",
  },
  {
    number: "03",
    icon: Clapperboard,
    title: "Generate & Mix",
    description:
      "AI writes Hook/Body/CTA scripts and generates video. Mix 3 segments into 27 unique combinations. Download MP4s.",
    mediaType: "video" as const,
    mediaSrc:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    mediaAlt: "Generated video ad preview",
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

                <div className="relative w-full max-w-[280px] md:max-w-none aspect-[16/10] rounded-xl border border-[#1f1f1f] overflow-hidden mb-5 bg-[#0f0f0f]">
                  {step.mediaType === "image" ? (
                    <Image
                      src={step.mediaSrc}
                      alt={step.mediaAlt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 90vw, 28vw"
                    />
                  ) : (
                    <video
                      className="h-full w-full object-cover"
                      autoPlay
                      loop
                      muted
                      playsInline
                      preload="none"
                    >
                      <source src={step.mediaSrc} type="video/mp4" />
                    </video>
                  )}
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
