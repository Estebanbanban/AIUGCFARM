"use client";

import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/lib/animations";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Starter",
    price: 29,
    description: "Perfect for testing the waters",
    features: [
      "27 segment credits/month",
      "3 batch generations",
      "1 AI persona",
      "Easy Mode generation",
      "720p export",
      "MP4 download",
    ],
    highlighted: false,
  },
  {
    name: "Growth",
    price: 79,
    description: "For brands ready to scale",
    features: [
      "90 segment credits/month",
      "10 batch generations",
      "3 AI personas",
      "Easy Mode generation",
      "1080p export",
      "Segment mixer (27 combos)",
      "Priority support",
      "Bulk product import",
      "Custom watermark",
    ],
    highlighted: true,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          {...fadeInUp}
          whileInView={fadeInUp.animate}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Pricing
          </p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            Start free. Upgrade when you&apos;re ready to scale.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto"
        >
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              variants={fadeInUp}
              className={`relative rounded-2xl border p-8 ${
                plan.highlighted
                  ? "border-primary shadow-lg shadow-primary/5"
                  : "border-border"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-block rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                    Most Popular
                  </span>
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {plan.description}
                </p>
              </div>
              <div className="mb-6">
                <span className="text-5xl font-bold">${plan.price}</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-3 text-sm"
                  >
                    <Check className="size-4 text-primary shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                variant={plan.highlighted ? "default" : "secondary"}
                size="lg"
                className="w-full"
              >
                Get Started
              </Button>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          {...fadeInUp}
          whileInView={fadeInUp.animate}
          viewport={{ once: true }}
          className="text-center text-sm text-muted-foreground mt-12"
        >
          All plans include: 9 free segment credits &middot; No watermarks on
          paid &middot; MP4 download &middot; Cancel anytime
        </motion.p>
      </div>
    </section>
  );
}
