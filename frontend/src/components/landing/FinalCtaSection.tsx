"use client";

import { FadeInUp } from "@/lib/motion";
import { UrlInputCta } from "./UrlInputCta";

export function FinalCtaSection() {
  return (
    <section className="bg-gradient-to-b from-background to-background-secondary py-32 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto text-center">
        <FadeInUp>
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-6">Get Started</p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">
            Ready to Scale Your Ad Creative?
          </h2>
          <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
            Stop paying $500 per UGC video.<br />
            Start generating unlimited variations.
          </p>
          <UrlInputCta location="final_cta" />
          <p className="text-xs text-muted-foreground mt-6">
            Join 500+ e-commerce brands using CineRads
          </p>
        </FadeInUp>
      </div>
    </section>
  );
}
