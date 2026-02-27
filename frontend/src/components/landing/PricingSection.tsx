"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { ScaleIn, FadeInUp } from "@/lib/motion";

const plans = [
  {
    name: "Starter",
    price: 29,
    description: "Perfect for testing and launching your first UGC campaigns.",
    features: [
      "27 segment credits / mo",
      "1 AI persona",
      "1 brand profile",
      "Easy Mode",
      "720p MP4 export",
      "Free trial (3 segments)",
    ],
    cta: "Get Started",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Growth",
    price: 79,
    description: "For brands scaling their ad creative output seriously.",
    features: [
      "90 segment credits / mo",
      "3 AI personas",
      "3 brand profiles",
      "Easy + Expert Mode",
      "1080p MP4 export",
      "Custom scripts",
      "Priority generation",
    ],
    cta: "Get Started",
    href: "/signup",
    highlighted: true,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="bg-background py-24 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <FadeInUp className="text-center mb-14">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3">Pricing</p>
          <h2 className="text-[clamp(2rem,4vw,3rem)] font-semibold tracking-tight text-foreground">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            Start free. Scale when you&apos;re ready.
          </p>
        </FadeInUp>

        <div className="grid md:grid-cols-2 gap-4">
          {plans.map((plan, i) => (
            <ScaleIn key={plan.name} delay={i * 0.1}>
              <div
                className={`relative rounded-2xl p-8 flex flex-col h-full transition-all duration-300 ${
                  plan.highlighted
                    ? "bg-card border border-primary/40 shadow-[0_0_40px_rgba(249,115,22,0.07)]"
                    : "bg-card border border-border hover:border-primary/30"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-white text-xs font-medium rounded-full px-3 py-1">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                  <p className="text-muted-foreground text-sm mt-1">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold text-foreground">${plan.price}</span>
                    <span className="text-muted-foreground text-lg">/mo</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5">
                      <Check className="size-4 text-primary flex-shrink-0" strokeWidth={2} />
                      <span className="text-sm text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className={`w-full py-3 rounded-full text-sm font-medium text-center transition-all duration-200 block ${
                    plan.highlighted
                      ? "bg-primary text-white hover:bg-orange-600"
                      : "border border-border text-foreground hover:border-primary/40"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            </ScaleIn>
          ))}
        </div>

        <FadeInUp delay={0.3}>
          <p className="text-center text-xs text-muted-foreground mt-8">
            All plans include: Free trial (3 segments) · No watermarks · MP4 download · Cancel anytime
          </p>
        </FadeInUp>
      </div>
    </section>
  );
}
