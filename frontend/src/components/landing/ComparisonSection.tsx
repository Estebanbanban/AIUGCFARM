"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { FadeInUp } from "@/lib/motion";
import Link from "next/link";

const comparisons = [
  { them: "1 video per generation",  us: "27 unique ads per generation" },
  { them: "$8–500 per video",         us: "$0.46 per video" },
  { them: "Generic AI avatars",       us: "Custom persona for your brand" },
  { them: "Start over every time",    us: "Mix freely, no extra credits" },
];

export function ComparisonSection() {
  return (
    <section className="bg-background-secondary py-20 md:py-24 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">

        <FadeInUp className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-4">Why switch</p>
          <h2 className="text-[clamp(2.25rem,4.5vw,3.5rem)] font-semibold tracking-tight">
            What you get with{" "}
            <span className="font-serif italic text-primary">CineRads</span>
          </h2>
        </FadeInUp>

        <FadeInUp delay={0.05}>
          <div className="grid grid-cols-[1fr_48px_1fr] mb-4 px-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 text-center">Others</p>
            <div />
            <p className="text-xs font-semibold uppercase tracking-widest text-primary text-center">CineRads</p>
          </div>
        </FadeInUp>

        <div className="space-y-4">
          {comparisons.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.25, 0.4, 0.25, 1] }}
              className="grid grid-cols-[1fr_48px_1fr] items-center"
            >
              {/* Them — shrinks + turns redder */}
              <motion.div
                animate={{
                  opacity: [0.7, 0.25, 0.7],
                  scale: [1, 0.97, 1],
                  filter: ["brightness(1)", "brightness(0.6)", "brightness(1)"],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.5,
                }}
                className="rounded-2xl bg-muted/30 border border-border/60 px-6 py-5 text-center"
              >
                <p className="text-base text-muted-foreground line-through decoration-muted-foreground/40 leading-snug">
                  {c.them}
                </p>
              </motion.div>

              {/* Arrow */}
              <div className="flex justify-center">
                <motion.div
                  animate={{ x: [0, 7, 0], scale: [1, 1.2, 1] }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.5 + 0.2,
                  }}
                >
                  <ArrowRight className="size-5 text-primary" />
                </motion.div>
              </div>

              {/* Us — scale breathe + strong glow + shimmer sweep */}
              <motion.div
                animate={{
                  scale: [1, 1.03, 1],
                  boxShadow: [
                    "0 0 0px rgba(249,115,22,0)",
                    "0 0 32px rgba(249,115,22,0.35)",
                    "0 0 0px rgba(249,115,22,0)",
                  ],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.5,
                }}
                className="relative overflow-hidden rounded-2xl bg-primary/10 border border-primary/30 px-6 py-5 text-center"
              >
                {/* Shimmer sweep */}
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%)",
                  }}
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    repeatDelay: 2.5,
                    ease: "easeInOut",
                    delay: i * 0.5 + 0.5,
                  }}
                />
                <p className="relative text-base font-semibold text-foreground leading-snug">
                  {c.us}
                </p>
              </motion.div>
            </motion.div>
          ))}
        </div>

        <FadeInUp delay={0.2} className="mt-14 text-center">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-orange-600"
          >
            Try free
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">No credit card required</p>
        </FadeInUp>

      </div>
    </section>
  );
}
