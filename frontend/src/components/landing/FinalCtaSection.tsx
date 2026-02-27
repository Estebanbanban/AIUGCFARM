"use client";

import { FadeInUp } from "@/lib/motion";
import { UrlInputCta } from "./UrlInputCta";

export function FinalCtaSection() {
  return (
    <section className="bg-gradient-to-b from-black to-[#0A0A0A] py-32 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto text-center">
        <FadeInUp>
          <p className="text-xs uppercase tracking-[0.15em] text-[#555] mb-6">Get Started</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-4">
            Ready to Scale Your Ad Creative?
          </h2>
          <p className="text-[#888] text-lg mb-10 leading-relaxed">
            Stop paying $500 per UGC video.<br />
            Start generating unlimited variations.
          </p>
          <UrlInputCta />
          <p className="text-xs text-[#444] mt-6">
            Join 500+ e-commerce brands using CineRads
          </p>
        </FadeInUp>
      </div>
    </section>
  );
}
