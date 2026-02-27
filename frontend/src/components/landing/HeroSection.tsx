"use client";

import { motion } from "framer-motion";
import { staggerContainer } from "@/lib/animations";
import { UrlInputCta } from "./UrlInputCta";

const headlineVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export function HeroSection() {
  return (
    <section className="relative pt-20 pb-4 md:pt-24 md:pb-6 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="text-center"
        >
          {/* Beta badge */}
          <motion.div
            variants={headlineVariants}
            transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
            className="mb-3"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              Now in Beta — Start creating for free
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={headlineVariants}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.4, 0.25, 1] }}
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
            transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
            className="mt-3 text-base md:text-lg text-muted-foreground max-w-xl mx-auto"
          >
            Import your product URL, build an AI spokesperson, and generate
            scroll-stopping video ads.
          </motion.p>

          {/* URL Input */}
          <motion.div
            variants={headlineVariants}
            transition={{ duration: 0.5, delay: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
            className="mt-5"
          >
            <UrlInputCta />
          </motion.div>

          {/* Trust indicators */}
          <motion.p
            variants={headlineVariants}
            transition={{ duration: 0.5, delay: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
            className="mt-3 text-xs text-muted-foreground"
          >
            No credit card required &middot; Free trial included &middot; 30-second setup
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
