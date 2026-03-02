"use client";

import { Shield, RefreshCw, Star } from "lucide-react";
import { FadeInUp } from "@/lib/motion";
import { UrlInputCta } from "./UrlInputCta";

export function FinalCtaSection() {
  return (
    <section className="bg-background py-28 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto text-center">
        <FadeInUp>
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-6">Get Started</p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">
            Ready to Scale Your{" "}
            <span className="font-serif italic text-primary">Ad Creative?</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
            Stop paying $500 per UGC video.<br />
            Start generating unlimited variations.
          </p>
          <UrlInputCta location="final_cta" />
          <p className="text-xs text-muted-foreground mt-4">
            No credit card for brand + persona setup
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground mt-4">
            <span className="flex items-center gap-1.5">
              <Shield className="size-3.5 text-green-500" /> Secured by Stripe
            </span>
            <span className="flex items-center gap-1.5">
              <RefreshCw className="size-3.5" /> Cancel anytime
            </span>
            <span className="flex items-center gap-1.5">
              <Star className="size-3.5 text-amber-500" /> 500+ brands already using it
            </span>
          </div>
        </FadeInUp>
      </div>
    </section>
  );
}
