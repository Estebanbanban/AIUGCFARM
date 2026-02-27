"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { FadeInUp, StaggerContainer, staggerItem } from "@/lib/motion";

const faqs = [
  {
    question: "What is a video credit?",
    answer:
      "One credit generates one full video ad with 3 segments (Hook, Body, CTA). You can mix segments from a single credit into up to 27 unique combinations.",
  },
  {
    question: "Which platforms are the videos optimized for?",
    answer:
      "Videos are optimized for TikTok, Meta (Facebook & Instagram Reels), and YouTube Shorts. All exports are 9:16 vertical format at up to 1080p.",
  },
  {
    question: "How long does it take to generate a video?",
    answer:
      "Most videos are generated in under 10 minutes. Complex batches may take slightly longer. You'll get an email notification when your video is ready.",
  },
  {
    question: "Can I write my own scripts?",
    answer:
      "Yes. You can use our AI-generated scripts or write and upload your own. You have full control over the Hook, Body, and CTA copy.",
  },
  {
    question: "Which stores are supported?",
    answer:
      "We support any public product URL, including Shopify, WooCommerce, BigCommerce, Amazon, and standalone product pages. If we can see it, we can import it.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Yes. Every new account gets 1 free video credit — no credit card required. Generate a full video ad and see the quality before you commit.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Absolutely. There are no contracts or cancellation fees. You can cancel your subscription at any time from your account settings.",
  },
  {
    question: "Who owns the generated content?",
    answer:
      "You do. All videos generated on CineRads are yours to use commercially without restriction. We retain no rights to your content.",
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-background-secondary py-24 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <FadeInUp className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3">FAQ</p>
          <h2 className="text-[clamp(2rem,4vw,3rem)] font-semibold tracking-tight text-foreground">
            Frequently Asked Questions
          </h2>
        </FadeInUp>

        <StaggerContainer staggerDelay={0.07}>
          {faqs.map((faq, i) => (
            <motion.div key={i} variants={staggerItem} className="border-b border-border">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between py-5 text-left group"
              >
                <span className="pr-4 text-sm font-medium text-foreground transition-colors group-hover:text-muted-foreground">
                  {faq.question}
                </span>
                <motion.div
                  animate={{ rotate: open === i ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-shrink-0"
                >
                  <ChevronDown className="size-4 text-muted-foreground" />
                </motion.div>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
