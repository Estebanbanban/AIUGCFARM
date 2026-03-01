"use client";

import { Link, Upload, Clapperboard } from "lucide-react";
import { FadeInUp, StaggerContainer, staggerItem } from "@/lib/motion";
import { motion } from "framer-motion";
import Image from "next/image";
import { VideoGenerationAnimation } from "./VideoGenerationAnimation";

const steps = [
  {
    number: "01",
    icon: Link,
    title: "Paste Your Product URL",
    description:
      "Drop any Shopify or store URL. Our AI UGC video generator imports everything - name, images, price, description - in seconds.",
    mediaType: "image" as const,
    mediaSrc:
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1200&q=80",
    mediaAlt: "Online fashion store products",
  },
  {
    number: "02",
    icon: Upload,
    title: "Design Your AI Spokesperson",
    description:
      "Configure your virtual brand spokesperson with 9 attributes. Tone, energy, style, age - saved and reused across every campaign.",
    mediaType: "image" as const,
    mediaSrc:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80",
    mediaAlt: "Creator portrait for persona generation",
  },
  {
    number: "03",
    icon: Clapperboard,
    title: "Get 27 Unique Video Ads",
    description:
      "AI writes Hook, Body, and CTA scripts for your product. Generate 3 segments of each type, then mix any combination for 27 ready-to-run TikTok and Meta ad creatives.",
    mediaType: "animation" as const,
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-background-secondary py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        {/* Heading */}
        <FadeInUp className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3">Process</p>
          <h2 className="text-[clamp(2rem,4vw,3rem)] font-semibold tracking-tight text-foreground">
            How CineRads Generates Your UGC Video Ads
          </h2>
        </FadeInUp>

        {/* Steps */}
        <StaggerContainer className="relative grid md:grid-cols-3 gap-0" staggerDelay={0.15}>
          {steps.map((step, i) => (
            <motion.div key={step.number} variants={staggerItem} className="relative">
              {/* Connecting dashed line between steps (desktop) */}
              {i < steps.length - 1 && (
                <div className="absolute left-16 top-[3.25rem] z-0 hidden h-0 w-[calc(100%-40px)] border-t border-dashed border-border md:block" />
              )}

              <div className="relative z-10 flex flex-col items-center md:items-start text-center md:text-left px-6 py-8">
                {/* Step number circle */}
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-primary/30 mb-5">
                  <span className="text-primary font-mono text-xs font-bold">{step.number}</span>
                </div>

                <div className="relative w-full max-w-[280px] md:max-w-none aspect-[10/7] rounded-xl border border-border overflow-hidden mb-5 bg-card">
                  {step.mediaType === "image" ? (
                    <Image
                      src={step.mediaSrc}
                      alt={step.mediaAlt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 90vw, 28vw"
                    />
                  ) : (
                    <VideoGenerationAnimation />
                  )}
                </div>

                {/* Icon */}
                <step.icon className="size-6 text-muted-foreground mb-4" strokeWidth={1.5} />

                <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>

              {/* Mobile connecting line */}
              {i < steps.length - 1 && (
                <div className="md:hidden mx-auto w-px h-8 border-l border-dashed border-border" />
              )}
            </motion.div>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
