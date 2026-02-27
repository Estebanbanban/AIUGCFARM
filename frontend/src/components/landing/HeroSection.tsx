"use client";

import { motion } from "framer-motion";
import { UrlInputCta } from "./UrlInputCta";

export function HeroSection() {
  return (
    <section className="relative min-h-[52vh] flex flex-col justify-end bg-black overflow-hidden pt-24 pb-4">
      {/* Subtle radial bloom behind headline */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.035) 0%, transparent 60%)",
        }}
      />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
        {/* Beta badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#333] px-3 py-1 text-xs text-[#999]"
        >
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          Now in Beta — Start creating for free
        </motion.div>

        {/* Headline — 3 lines revealing from bottom */}
        <div className="text-[clamp(2.8rem,8vw,5.5rem)] font-bold tracking-[-0.03em] leading-[1.05]">
          {[
            <span key="0" className="text-white">Your Products.</span>,
            <span key="1" className="text-white"><span className="text-primary">AI-Powered</span> Ads.</span>,
            <span key="2" className="text-white">Unlimited Scale.</span>,
          ].map((line, i) => (
            <div key={i} className="overflow-hidden">
              <motion.div
                initial={{ y: "110%" }}
                animate={{ y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 0.3 + i * 0.15,
                  ease: [0.25, 0.4, 0.25, 1],
                }}
              >
                {line}
              </motion.div>
            </div>
          ))}
        </div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.75, ease: [0.25, 0.4, 0.25, 1] }}
          className="mt-5 text-base md:text-lg text-[#999] max-w-lg mx-auto leading-relaxed"
        >
          Import your product URL, build an AI spokesperson, and generate
          scroll-stopping video ads.
        </motion.p>

        {/* URL Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9, ease: [0.25, 0.4, 0.25, 1] }}
          className="mt-7"
        >
          <UrlInputCta />
        </motion.div>

        {/* Trust line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.1 }}
          className="mt-3 text-xs text-[#555]"
        >
          No credit card required &middot; Free trial included &middot; 30-second setup
        </motion.p>
      </div>
    </section>
  );
}
