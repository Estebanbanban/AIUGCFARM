"use client";

import { FadeInUp, StaggerContainer, staggerItem } from "@/lib/motion";
import { motion } from "framer-motion";
import Image from "next/image";
import { VideoGenerationAnimation } from "./VideoGenerationAnimation";

const steps = [
  {
    number: "01",
    title: "Upload Your Product Images",
    description:
      "Drop your product photos into a collection. Import from Pinterest, upload from desktop, or scrape directly from your store URL.",
    mediaType: "image" as const,
    mediaSrc:
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1200&q=80",
    mediaAlt: "Product image collection",
  },
  {
    number: "02",
    title: "Pick a Hook & Write Your Copy",
    description:
      "Choose a TikTok or Instagram-style text hook. AI writes scroll-stopping copy for each slide, or write your own. Native fonts, branded look.",
    mediaType: "image" as const,
    mediaSrc:
      "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=1200&q=80",
    mediaAlt: "Slideshow hook with text overlay",
  },
  {
    number: "03",
    title: "Export as Video Slideshow",
    description:
      "Your slides become a ready-to-post video for TikTok, Reels, and Shorts. Timed transitions, text animations, and music-ready format.",
    mediaType: "animation" as const,
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-background py-16 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        {/* Heading */}
        <FadeInUp className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3">Process</p>
          <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-semibold tracking-tight text-foreground">
            Create Scroll-Stopping{" "}
            <span className="font-serif italic text-primary">Video Slideshows</span>
          </h2>
        </FadeInUp>

        {/* Steps */}
        <StaggerContainer className="grid md:grid-cols-3 gap-6 md:gap-8" staggerDelay={0.15}>
          {steps.map((step, i) => (
            <motion.div key={step.number} variants={staggerItem} className="flex flex-col gap-4">
              {/* Step number */}
              <span className="font-mono text-xs font-bold tracking-[0.15em] text-primary/60">{step.number}</span>

              <div className="relative w-full aspect-[10/7] rounded-xl border border-border overflow-hidden bg-card">
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

              <div>
                <h3 className="text-base font-semibold text-foreground mb-1.5">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
