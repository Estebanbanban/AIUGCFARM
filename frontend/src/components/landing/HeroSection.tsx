"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { UrlInputCta } from "./UrlInputCta";

const heroMedia = [
  {
    type: "image" as const,
    src: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
    alt: "Fashion ecommerce product shoot",
    label: "Fashion",
  },
  {
    type: "video" as const,
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    label: "UGC Reel",
  },
  {
    type: "image" as const,
    src: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80",
    alt: "Skincare closeup product image",
    label: "Beauty",
  },
  {
    type: "video" as const,
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    label: "Product Demo",
  },
];

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

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 1.2, ease: [0.25, 0.4, 0.25, 1] }}
          className="mt-9 grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          {heroMedia.map((media, i) => (
            <div key={`${media.label}-${i}`} className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-[#1f1f1f] bg-[#0f0f0f]">
              {media.type === "image" ? (
                <Image
                  src={media.src}
                  alt={media.alt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 45vw, 20vw"
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
                  <source src={media.src} type="video/mp4" />
                </video>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-3 pb-2.5 pt-8">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/85">{media.label}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
