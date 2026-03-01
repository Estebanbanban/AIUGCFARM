"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ScaleIn, FadeInUp } from "@/lib/motion";
import { createClient } from "@/lib/supabase/client";
import { callEdge } from "@/lib/api";
import { PLANS } from "@/lib/stripe";
import type { PlanTier } from "@/lib/stripe";
import { trackCtaClicked } from "@/lib/datafast";

// Landing-page-only metadata that does not exist in stripe.ts.
// Price, credits, name, and features always come from PLANS in stripe.ts.
const PLAN_UI: Record<
  PlanTier,
  {
    annualPrice: number;
    annualSavings: number;
    description: string;
    perVideo: string;
    cta: string;
    highlighted: boolean;
    isAgency: boolean;
  }
> = {
  starter: {
    annualPrice: 20,
    annualSavings: 60,
    description: "Perfect for testing and launching your first UGC campaigns.",
    perVideo: "$0.83/credit",
    cta: "Get Started",
    highlighted: false,
    isAgency: false,
  },
  growth: {
    annualPrice: 64,
    annualSavings: 192,
    description: "For brands scaling their ad creative output seriously.",
    perVideo: "$0.80/credit",
    cta: "Start Scaling",
    highlighted: true,
    isAgency: false,
  },
  scale: {
    annualPrice: 144,
    annualSavings: 432,
    description: "For agencies and large teams managing multiple brands.",
    perVideo: "$0.72/credit",
    cta: "Go Unlimited",
    highlighted: false,
    isAgency: true,
  },
};

// Derive the full plan list from stripe.ts, merging in landing-page-only fields.
const plans = (Object.keys(PLANS) as PlanTier[]).map((key) => ({
  key,
  name: PLANS[key].name,
  monthlyPrice: PLANS[key].price,
  features: [...PLANS[key].features],
  ...PLAN_UI[key],
}));

export function PricingSection() {
  const [annual, setAnnual] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<PlanTier | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
  }, []);

  async function handlePlanClick(planKey: PlanTier) {
    trackCtaClicked("pricing", planKey);
    if (!isLoggedIn) {
      router.push(`/signup?plan=${planKey}${annual ? "&billing=annual" : ""}`);
      return;
    }

    setLoadingPlan(planKey);
    try {
      const res = await callEdge<{ data: { url: string } }>("stripe-checkout", {
        body: { plan: planKey, billing: annual ? "annual" : "monthly" },
      });
      window.location.href = res.data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed. Please try again.");
      setLoadingPlan(null);
    }
  }

  return (
    <section id="pricing" className="bg-background py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <FadeInUp className="text-center mb-14">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3">Pricing</p>
          <p className="text-sm text-[#888] mb-4">
            Traditional UGC creators charge $150-$500 per video.
          </p>
          <h2 className="text-[clamp(2rem,4vw,3rem)] font-semibold tracking-tight text-foreground">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground mt-3 text-base">
            Start free. Scale when you&apos;re ready.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setAnnual(false)}
              className={`text-sm font-medium transition-colors ${
                !annual ? "text-white" : "text-[#666]"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(!annual)}
              className="relative w-11 h-6 rounded-full bg-[#222] border border-[#333] transition-all flex items-center"
              aria-label="Toggle billing period"
            >
              <span
                className={`absolute w-4 h-4 rounded-full bg-primary transition-all duration-200 ${
                  annual ? "left-6" : "left-1"
                }`}
              />
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`text-sm font-medium transition-colors flex items-center gap-2 ${
                annual ? "text-white" : "text-[#666]"
              }`}
            >
              Annual
              <span className="text-primary text-xs font-medium">Save 20%</span>
            </button>
          </div>
        </FadeInUp>

        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((plan, i) => {
            const price = annual ? plan.annualPrice : plan.monthlyPrice;
            const isLoading = loadingPlan === plan.key;
            return (
              <ScaleIn key={plan.name} delay={i * 0.1}>
                <div
                  className={`relative rounded-2xl p-8 flex flex-col h-full transition-all duration-300 ${
                    plan.highlighted
                      ? "bg-card border border-primary/40 shadow-[0_0_40px_rgba(249,115,22,0.07)]"
                      : plan.isAgency
                      ? "bg-card border border-[#333] hover:border-[#555]"
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

                  <div className="mb-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-bold text-foreground">${price}</span>
                      <span className="text-muted-foreground text-lg">/mo</span>
                    </div>
                    {annual && (
                      <p className="text-xs text-[#888] mt-1">
                        billed annually · save ${plan.annualSavings}/yr
                      </p>
                    )}
                    <p className="text-xs text-primary mt-1">
                      {plan.perVideo} vs. $500 with traditional UGC
                    </p>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1 mt-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5">
                        <Check className="size-4 text-primary flex-shrink-0" strokeWidth={2} />
                        <span className="text-sm text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handlePlanClick(plan.key)}
                    disabled={!!loadingPlan}
                    className={`w-full py-3 rounded-full text-sm font-medium text-center transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${
                      plan.highlighted
                        ? "bg-primary text-white hover:bg-orange-600"
                        : plan.isAgency
                        ? "bg-white text-black hover:bg-[#f0f0f0]"
                        : "border border-border text-foreground hover:border-primary/40"
                    }`}
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      plan.cta
                    )}
                  </button>
                </div>
              </ScaleIn>
            );
          })}
        </div>

        <FadeInUp delay={0.3}>
          <p className="text-center text-xs text-muted-foreground mt-8">
            All plans include: No watermarks · MP4 download · Cancel anytime
          </p>
          <p className="text-center text-xs text-primary mt-3">
            Beta pricing - lock in your rate forever. Prices increase at public launch.
          </p>
        </FadeInUp>
      </div>
    </section>
  );
}
