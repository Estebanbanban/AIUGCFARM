"use client";

import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/lib/animations";
import { UrlInputCta } from "./UrlInputCta";

export function FinalCtaSection() {
  return (
    <section className="bg-foreground text-background py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="text-center"
        >
          <motion.h2
            variants={fadeInUp}
            className="text-4xl md:text-5xl font-bold tracking-tight"
          >
            Ready to Scale Your Ad Creative?
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="mt-4 text-lg text-white/60 max-w-xl mx-auto"
          >
            Join hundreds of brands creating AI-powered video ads. Start with a
            free credit — no card required.
          </motion.p>
          <motion.div variants={fadeInUp} className="mt-10">
            <UrlInputCta inverted />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
