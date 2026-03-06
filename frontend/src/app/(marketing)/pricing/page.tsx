import { PricingSection } from "@/components/landing/PricingSection";
import { Check, X, Film, Zap, Layers } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { CREDIT_PACKS } from "@/lib/stripe";
import type { CreditPackKey } from "@/lib/stripe";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Pricing, CineRads",
  description:
    "Simple, transparent pricing for AI-powered UGC video ad generation. Start free, scale as you grow.",
};

const comparisonRows = [
  { feature: "Credits/month", starter: "30", growth: "100", scale: "250" },
  { feature: "Ad combos/mo · Standard Triple", starter: "54", growth: "162", scale: "432" },
  { feature: "Ad combos/mo · HD Triple", starter: "27", growth: "81", scale: "216" },
  { feature: "Brands", starter: "1", growth: "3", scale: "Unlimited" },
  { feature: "Products/brand", starter: "5", growth: "20", scale: "Unlimited" },
  { feature: "AI personas/month", starter: "2", growth: "10", scale: "100" },
  { feature: "AI-Written Scripts", starter: true, growth: true, scale: true },
  { feature: "Custom Script Editor", starter: false, growth: true, scale: true },
  { feature: "Export resolution", starter: "720p", growth: "1080p", scale: "1080p" },
  { feature: "10% off credit packs", starter: false, growth: true, scale: false },
  { feature: "20% off credit packs", starter: false, growth: false, scale: true },
  { feature: "Priority generation", starter: false, growth: true, scale: true },
  { feature: "Priority support", starter: false, growth: false, scale: true },
];

function CellValue({ value }: { value: string | boolean }) {
  if (typeof value === "string") {
    return <span className="text-sm text-muted-foreground">{value}</span>;
  }
  if (value) {
    return <Check className="mx-auto size-4 text-primary" />;
  }
  return <X className="mx-auto size-4 text-zinc-600" />;
}

export default function PricingPage() {
  return (
    <div className="pt-16">
      <PricingSection />

      {/* Credit Packs */}
      <section className="pb-16 md:pb-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Top Up Credits</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              One-time purchase, no subscription required. Credits never expire.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {(Object.entries(CREDIT_PACKS) as [CreditPackKey, (typeof CREDIT_PACKS)[CreditPackKey]][]).map(([key, pack]) => {
              const isBestValue = "badge" in pack && pack.badge === "Best value";
              const videosStandard = Math.floor(pack.credits / 5);
              const videosHd = Math.floor(pack.credits / 10);
              const tripleStandard = Math.floor(pack.credits / 15);
              const combosTriple = tripleStandard * 27;

              return (
                <div
                  key={key}
                  className={cn(
                    "flex flex-col rounded-2xl border p-5 transition-all duration-200",
                    isBestValue
                      ? "border-primary/40 bg-card shadow-[0_0_30px_rgba(249,115,22,0.06)]"
                      : "border-border bg-card hover:border-primary/30"
                  )}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{pack.name}</h3>
                    {"badge" in pack && pack.badge && (
                      <Badge variant="secondary" className={cn("text-xs", isBestValue && "bg-primary/10 text-primary")}>
                        {pack.badge}
                      </Badge>
                    )}
                  </div>

                  <div className="mb-1 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">${pack.price}</span>
                  </div>
                  <p className="mb-4 text-xs text-primary">${pack.pricePerCredit}/credit</p>

                  <ul className="mb-5 flex flex-1 flex-col gap-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 shrink-0 text-primary" strokeWidth={2.5} />
                      <strong className="text-foreground">{pack.credits} credits</strong>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 shrink-0 text-primary" strokeWidth={2.5} />
                      {videosStandard} standard or {videosHd} HD videos
                    </li>
                    {tripleStandard > 0 && (
                      <li className="flex items-center gap-2">
                        <Check className="size-3.5 shrink-0 text-emerald-400" strokeWidth={2.5} />
                        <span>{tripleStandard} Triple batch{tripleStandard > 1 ? "es" : ""} = <strong className="text-foreground">{combosTriple} ad combos</strong></span>
                      </li>
                    )}
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 shrink-0 text-primary" strokeWidth={2.5} />
                      Never expire
                    </li>
                  </ul>

                  <Link
                    href="/signup"
                    className={cn(
                      "w-full rounded-full py-2.5 text-center text-sm font-medium transition-all duration-200",
                      isBestValue
                        ? "bg-primary text-white hover:bg-orange-600"
                        : "border border-border text-foreground hover:border-primary/40"
                    )}
                  >
                    Buy Now
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How Credits Work */}
      <section className="pb-16 md:pb-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-5 text-base font-semibold tracking-tight">How credits work</h2>

            <div className="grid gap-5 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
                    <Film className="size-4 text-primary" />
                  </div>
                  <span className="text-sm font-semibold">Standard</span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <strong className="text-foreground">5 credits</strong> = 1 complete ad
                  (hook + body + CTA) rendered with Kling v2.6.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
                    <Zap className="size-4 text-primary" />
                  </div>
                  <span className="text-sm font-semibold">HD</span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <strong className="text-foreground">10 credits</strong> = 1 complete HD ad
                  rendered with Kling v3 - sharper, more cinematic.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10">
                    <Layers className="size-4 text-emerald-400" />
                  </div>
                  <span className="text-sm font-semibold">Triple Mode</span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <strong className="text-foreground">15 credits</strong> = 3 hooks × 3 bodies × 3 CTAs
                  = <strong className="text-foreground">27 unique ad combos</strong> from one generation.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-400">
                Why Triple Mode is the smart choice
              </p>
              <p className="text-sm text-muted-foreground">
                One 15-credit batch gives you 27 mix-and-match video combinations to A/B test across
                TikTok, Reels, and Shorts - finding your winning creative in days, not weeks.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["15 cr → 27 combos", "$0.56/combo (standard)", "vs $5/single video"].map((tag) => (
                  <span key={tag} className="rounded-md border border-emerald-500/20 bg-card px-2.5 py-1 text-xs text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="pb-20 md:pb-32">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h3 className="mb-8 text-center text-xl font-semibold text-foreground">
            Feature Comparison
          </h3>

          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                    Feature
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-muted-foreground">
                    Starter
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-primary">
                    Growth
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-muted-foreground">
                    Scale
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {comparisonRows.map((row) => (
                  <tr
                    key={row.feature}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {row.feature}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <CellValue value={row.starter} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <CellValue value={row.growth} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <CellValue value={row.scale} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
