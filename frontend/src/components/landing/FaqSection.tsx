"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/lib/animations";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "What is a video credit?",
    a: "One credit generates one full video ad with 3 segments (Hook, Body, CTA). You can mix segments from a single credit into up to 27 unique combinations.",
  },
  {
    q: "Which platforms are the videos optimized for?",
    a: "Videos are optimized for TikTok, Meta (Facebook & Instagram Reels), and YouTube Shorts. All exports are 9:16 vertical format at up to 1080p.",
  },
  {
    q: "How long does it take to generate a video?",
    a: "Most videos are generated in under 10 minutes. Complex batches may take slightly longer. You'll get an email notification when your video is ready.",
  },
  {
    q: "Can I write my own scripts?",
    a: "Yes. You can use our AI-generated scripts or write and upload your own. You have full control over the Hook, Body, and CTA copy.",
  },
  {
    q: "Which stores are supported?",
    a: "We support any public product URL, including Shopify, WooCommerce, BigCommerce, Amazon, and standalone product pages. If we can see it, we can import it.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes. Every new account gets 1 free video credit — no credit card required. Generate a full video ad and see the quality before you commit.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Absolutely. There are no contracts or cancellation fees. You can cancel your subscription at any time from your account settings.",
  },
  {
    q: "Who owns the generated content?",
    a: "You do. All videos generated on CineRads are yours to use commercially without restriction. We retain no rights to your content.",
  },
];

function FaqItem({
  faq,
  isOpen,
  onToggle,
}: {
  faq: (typeof faqs)[number];
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <span className="text-sm font-medium pr-4">{faq.q}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm text-muted-foreground leading-relaxed">
              {faq.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          {...fadeInUp}
          whileInView={fadeInUp.animate}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
            FAQ
          </p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Frequently Asked Questions
          </h2>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          {faqs.map((faq, i) => (
            <motion.div key={i} variants={fadeInUp}>
              <FaqItem
                faq={faq}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
