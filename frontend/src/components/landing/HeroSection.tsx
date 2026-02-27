"use client";

import { motion } from "framer-motion";
import { staggerContainer } from "@/lib/animations";
import { UrlInputCta } from "./UrlInputCta";
import { Play, Heart, MessageCircle, Share2 } from "lucide-react";

const headlineVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

function HeroMockup() {
  return (
    <div className="relative mx-auto max-w-4xl">
      {/* Glow effect behind the mockup */}
      <div className="absolute inset-0 -top-8 mx-auto w-3/4 h-full bg-primary/5 blur-3xl rounded-full" />

      <div className="relative flex items-end justify-center gap-4 md:gap-6">
        {/* Left phone - smaller */}
        <div className="hidden sm:block w-[140px] md:w-[170px] -mb-4 opacity-60">
          <div className="aspect-[9/16] rounded-[1.8rem] border-[6px] border-zinc-800 shadow-2xl overflow-hidden relative bg-black">
            <div className="absolute inset-0 bg-gradient-to-b from-rose-900/80 to-rose-700/80" />
            <div className="relative h-full flex flex-col justify-end p-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-white">Hydra Serum</p>
                <p className="text-[8px] text-white/60">$45.00</p>
                <div className="w-full rounded-md bg-white/20 py-1.5 text-center text-[9px] font-medium text-white">
                  Shop Now
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center phone - main / larger */}
        <div className="w-[200px] md:w-[240px] z-10">
          <div className="aspect-[9/16] rounded-[2.2rem] border-[7px] border-zinc-800 shadow-2xl shadow-primary/10 overflow-hidden relative bg-black ring-1 ring-primary/20">
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 to-zinc-900" />
            {/* Simulated video content */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="size-14 rounded-full bg-primary/20 flex items-center justify-center backdrop-blur-sm border border-primary/30">
                <Play className="size-6 text-primary ml-0.5" fill="currentColor" />
              </div>
            </div>
            {/* Top bar */}
            <div className="relative p-3 flex items-center gap-1.5">
              <div className="size-6 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-[8px] font-bold text-primary">CR</span>
              </div>
              <div>
                <p className="text-[9px] font-semibold text-white">CineRads</p>
                <p className="text-[7px] text-white/50">Sponsored</p>
              </div>
            </div>
            {/* Right side icons */}
            <div className="absolute right-2.5 bottom-20 flex flex-col items-center gap-3">
              <div className="flex flex-col items-center gap-0.5">
                <div className="size-8 rounded-full bg-white/10 flex items-center justify-center">
                  <Heart className="size-3.5 text-white" />
                </div>
                <span className="text-[8px] text-white/70">24.5K</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <div className="size-8 rounded-full bg-white/10 flex items-center justify-center">
                  <MessageCircle className="size-3.5 text-white" />
                </div>
                <span className="text-[8px] text-white/70">1.2K</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <div className="size-8 rounded-full bg-white/10 flex items-center justify-center">
                  <Share2 className="size-3.5 text-white" />
                </div>
                <span className="text-[8px] text-white/70">Share</span>
              </div>
            </div>
            {/* Bottom product info */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-xs font-semibold text-white">Cloud Runner Pro</p>
              <p className="text-[9px] text-white/60">$129.00</p>
              <div className="mt-1.5 w-full rounded-md bg-primary py-1.5 text-center text-[9px] font-semibold text-white">
                Shop Now
              </div>
            </div>
          </div>
        </div>

        {/* Right phone - smaller */}
        <div className="hidden sm:block w-[140px] md:w-[170px] -mb-4 opacity-60">
          <div className="aspect-[9/16] rounded-[1.8rem] border-[6px] border-zinc-800 shadow-2xl overflow-hidden relative bg-black">
            <div className="absolute inset-0 bg-gradient-to-b from-green-900/80 to-green-700/80" />
            <div className="relative h-full flex flex-col justify-end p-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-white">Vital Blend</p>
                <p className="text-[8px] text-white/60">$39.00</p>
                <div className="w-full rounded-md bg-white/20 py-1.5 text-center text-[9px] font-medium text-white">
                  Shop Now
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="text-center"
        >
          {/* Pill badge */}
          <motion.div
            variants={headlineVariants}
            transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
            className="mb-8"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5 text-sm text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              Now in Beta — Start creating for free
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={headlineVariants}
            transition={{
              duration: 0.5,
              delay: 0.1,
              ease: [0.25, 0.4, 0.25, 1],
            }}
            className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.08]"
          >
            Your Products.
            <br />
            <span className="text-primary">AI-Powered</span> Ads.
            <br />
            Unlimited Scale.
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={headlineVariants}
            transition={{
              duration: 0.5,
              delay: 0.2,
              ease: [0.25, 0.4, 0.25, 1],
            }}
            className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
          >
            Import your product URL, build an AI spokesperson, and generate
            scroll-stopping video ads for TikTok, Meta, and YouTube Shorts.
          </motion.p>

          {/* URL Input */}
          <motion.div
            variants={headlineVariants}
            transition={{
              duration: 0.5,
              delay: 0.3,
              ease: [0.25, 0.4, 0.25, 1],
            }}
            className="mt-10"
          >
            <UrlInputCta />
          </motion.div>

          {/* Trust indicators */}
          <motion.p
            variants={headlineVariants}
            transition={{
              duration: 0.5,
              delay: 0.4,
              ease: [0.25, 0.4, 0.25, 1],
            }}
            className="mt-6 text-sm text-muted-foreground"
          >
            No credit card required &middot; Free trial included &middot;
            30-second setup
          </motion.p>

          {/* Hero mockup - phone previews */}
          <motion.div
            variants={headlineVariants}
            transition={{
              duration: 0.7,
              delay: 0.5,
              ease: [0.25, 0.4, 0.25, 1],
            }}
            className="mt-16 md:mt-20"
          >
            <HeroMockup />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
