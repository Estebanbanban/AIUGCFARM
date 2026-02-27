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

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45, ease: [0.25, 0.4, 0.25, 1] }}
            className="mt-6 text-lg md:text-xl text-[#999] max-w-2xl mx-auto text-center leading-relaxed"
          >
            The AI UGC video generator that turns your store URL into 27 ready-to-run
            video ads in under 10 minutes. No creators. No editing. No $500 invoices.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            className="mt-4 flex justify-center"
          >
            <span className="border border-primary/30 bg-primary/5 text-primary text-xs rounded-full px-3 py-1 inline-flex items-center gap-1.5">
              <span>🎁</span>
              3 free video segments — no credit card needed
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
            className="mt-10"
          >
            <UrlInputCta />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.8 }}
            className="mt-4 flex justify-center"
          >
            <button
              onClick={() => {
                const el = document.getElementById("how-it-works");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-sm text-[#888] hover:text-white transition-colors flex items-center gap-2"
            >
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-[#555]">▶</span>
              Watch how it works
            </button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.65 }}
            className="mt-4 text-sm text-[#888]"
          >
            No credit card required · <span className="text-primary font-medium">Free trial included</span> · Cancel anytime
          </motion.p>
        </div>
      </div>
    </section>
  );
}
