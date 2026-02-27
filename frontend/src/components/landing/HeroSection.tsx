"use client";

import { motion } from "framer-motion";
import { UrlInputCta } from "./UrlInputCta";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-black pt-24 pb-16 md:pt-28 md:pb-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(249,115,22,0.26),transparent_54%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05),transparent_64%)]" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.25, 0.4, 0.25, 1] }}
            className="mx-auto max-w-5xl text-[clamp(2.4rem,7vw,5.8rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-white"
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
            className="mt-4 text-sm text-[#a3a3a3]"
          >
            No credit card required • Free trial included
          </motion.p>
        </div>
      </div>
    </section>
  );
}
