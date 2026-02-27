"use client";

import { motion } from "framer-motion";
import { UrlInputCta } from "./UrlInputCta";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-black pt-24 pb-16 md:pt-28 md:pb-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(249,115,22,0.24),transparent_52%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.06),transparent_60%)]" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.25, 0.4, 0.25, 1] }}
            className="mx-auto max-w-5xl text-[clamp(2.8rem,8vw,7rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-white"
          >
            Turn Any Product URL
            <br />
            Into <span className="font-serif italic text-primary">UGC Video Ads.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
            className="mx-auto mt-8 max-w-3xl text-lg text-white/85 md:text-xl"
          >
            Import your product page, generate multiple ad angles, and launch creatives
            ready for TikTok, Reels, and Shorts.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.35, ease: [0.25, 0.4, 0.25, 1] }}
            className="mt-3 text-[#b8b8b8]"
          >
            Hook, Body, CTA. Faster testing. Better winners.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
            className="mt-9"
          >
            <UrlInputCta />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.65 }}
            className="mt-4 text-sm text-[#a3a3a3]"
          >
            No credit card required • Free trial included
          </motion.p>
        </div>
      </div>
    </section>
  );
}
