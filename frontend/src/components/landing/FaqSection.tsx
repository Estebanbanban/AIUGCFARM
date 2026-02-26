"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "How do segment credits work?",
    answer:
      "Each segment credit generates one video segment (hook, body, or CTA). A typical video uses 3 segments. With the Starter plan's 27 credits, you can create up to 9 complete videos per month.",
  },
  {
    question: "What platforms do you support for scraping?",
    answer:
      "We currently support Shopify stores as our primary platform with automatic product import. For other platforms, you can manually upload product data.",
  },
  {
    question: "How long does video generation take?",
    answer:
      "Script generation takes about 5 seconds. Video segments generate in 1-3 minutes each. A complete 3-segment video is typically ready in under 5 minutes.",
  },
  {
    question: "What video quality can I expect?",
    answer:
      "Videos are generated using state-of-the-art AI models. Starter plans export at 720p, Growth plans at 1080p. Each generation produces 4 variations so you can pick the best one.",
  },
  {
    question: "Can I edit the AI-generated script?",
    answer:
      "Expert Mode (available on Growth plans) lets you edit each segment's script before generation. You can mix AI-generated and custom-written segments.",
  },
  {
    question: "What's the Mix & Match feature?",
    answer:
      "Instead of generating one full video, we generate individual segments (hooks, bodies, CTAs) that you can combine freely. 3 hooks \u00d7 3 bodies \u00d7 3 CTAs = 27 unique video combinations.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "Yes! If you're not satisfied within the first 7 days, we'll refund your subscription. Unused credits do not roll over between billing periods.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Absolutely. All data is encrypted at rest and in transit. We never store payment information \u2014 that's handled entirely by Stripe. Product data is only accessible to your account.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function toggle(index: number) {
    setOpenIndex(openIndex === index ? null : index);
  }

  return (
    <section id="faq" className="relative py-20 md:py-32">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-violet-400">
            Support
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Frequently Asked Questions
          </h2>
        </div>

        {/* FAQ items */}
        <div className="mt-16 flex flex-col divide-y divide-white/5">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={index} className="py-5">
                <button
                  onClick={() => toggle(index)}
                  className="flex w-full items-center justify-between gap-4 text-left"
                >
                  <span className="text-base font-medium text-white">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-5 shrink-0 text-zinc-500 transition-transform duration-200",
                      isOpen && "rotate-180 text-violet-400"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-all duration-200",
                    isOpen
                      ? "grid-rows-[1fr] opacity-100 mt-3"
                      : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="text-sm leading-relaxed text-zinc-400">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
