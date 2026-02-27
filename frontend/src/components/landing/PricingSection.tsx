import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Starter",
    price: "$29",
    period: "/month",
    popular: false,
    features: [
      "27 segment credits/month",
      "3 batch generations",
      "1 AI persona",
      "Easy Mode generation",
      "720p export",
      "MP4 download",
    ],
  },
  {
    name: "Growth",
    price: "$79",
    period: "/month",
    popular: true,
    features: [
      "90 segment credits/month",
      "10 batch generations",
      "3 AI personas",
      "Easy Mode generation",
      "720p export",
      "MP4 download",
      "Priority support",
    ],
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="relative py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-violet-400">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-4 text-zinc-400">
            Start free. Scale as you grow.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="mt-16 grid gap-8 md:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative flex flex-col rounded-2xl border p-8 transition-all",
                plan.popular
                  ? "border-violet-500/40 bg-zinc-900/60 shadow-lg shadow-violet-500/5"
                  : "border-white/5 bg-zinc-900/30"
              )}
            >
              {/* Popular badge */}
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white hover:bg-violet-600">
                  Most Popular
                </Badge>
              )}

              {/* Plan name */}
              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>

              {/* Price */}
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">
                  {plan.price}
                </span>
                <span className="text-sm text-zinc-500">{plan.period}</span>
              </div>

              {/* Features */}
              <ul className="mt-8 flex flex-col gap-3 flex-1">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-sm text-zinc-300"
                  >
                    <Check className="mt-0.5 size-4 shrink-0 text-violet-400" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button
                asChild
                size="lg"
                className={cn(
                  "mt-8 w-full",
                  plan.popular
                    ? "bg-violet-600 text-white hover:bg-violet-500"
                    : "bg-white/5 text-white hover:bg-white/10"
                )}
              >
                <Link href="/sign-up">Get Started</Link>
              </Button>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <p className="mt-10 text-center text-sm text-zinc-500">
          All plans include: 9 free segment credits &bull; No watermarks on paid &bull;
          MP4 download
        </p>
      </div>
    </section>
  );
}
