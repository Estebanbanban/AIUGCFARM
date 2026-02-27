"use client";

import { motion } from "framer-motion";
import { UrlInputCta } from "./UrlInputCta";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-background pt-44 pb-28 md:pt-52 md:pb-36">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(249,115,22,0.24),transparent_52%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(0,0,0,0.07),transparent_60%)] dark:bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.06),transparent_60%)]" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.25, 0.4, 0.25, 1] }}
            className="mx-auto max-w-5xl text-[clamp(2.4rem,7vw,5.8rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-foreground"
          >
            <span className="block whitespace-nowrap">Turn Any Product URL</span>
            <span className="block whitespace-nowrap">
              Into <span className="font-serif italic text-primary">UGC Video Ads.</span>
            </span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
            className="mt-10"
          >
            <UrlInputCta />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.65 }}
            className="mt-4 text-sm text-muted-foreground"
          >
            No credit card required • Free trial included
          </motion.p>
        </div>
      </div>
    </section>
  );
}
