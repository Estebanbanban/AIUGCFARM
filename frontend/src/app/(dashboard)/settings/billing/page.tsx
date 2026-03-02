"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CreditCard,
  Loader2,
  Check,
  Zap,
  Film,
  Layers,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { PLANS, CREDIT_PACKS, type PlanTier, type CreditPackKey } from "@/lib/stripe";
import { useCredits } from "@/hooks/use-credits";
import { useProfile } from "@/hooks/use-profile";
import { useSubscription, useCreditLedger } from "@/hooks/use-billing";
import { useBillingPortal, useCheckout, useBuyCredits } from "@/hooks/use-checkout";
import { useFirstPurchaseOffer } from "@/hooks/use-first-purchase-offer";

const PLAN_HIGHLIGHTS: Record<PlanTier, { badge?: string; highlighted: boolean; ctaLabel: string }> = {
  starter: { highlighted: false, ctaLabel: "Switch to Starter" },
  growth:  { badge: "Most Popular", highlighted: true, ctaLabel: "Switch to Growth" },
  scale:   { highlighted: false, ctaLabel: "Switch to Scale" },
};

const reasonLabels: Record<string, { label: string; color: string }> = {
  generation:            { label: "Generation",   color: "text-red-400" },
  subscription_renewal:  { label: "Credit Grant", color: "text-emerald-400" },
  subscription_purchase: { label: "Credit Grant", color: "text-emerald-400" },
  credit_pack_purchase:  { label: "Pack Purchase",color: "text-emerald-400" },
  refund:                { label: "Refund",        color: "text-primary" },
  bonus:                 { label: "Bonus",         color: "text-primary" },
  free_trial:            { label: "Free Trial",    color: "text-amber-400" },
};

const statusColors: Record<string, string> = {
  active:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  past_due:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
  canceled:   "bg-red-500/10 text-red-400 border-red-500/20",
  incomplete: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export default function BillingPage() {
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const { data: credits, isLoading: creditsLoading } = useCredits();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: subscription, isLoading: subLoading } = useSubscription();
  const { data: ledger, isLoading: ledgerLoading } = useCreditLedger();
  const billingPortal = useBillingPortal();
  const checkout = useCheckout();
  const buyCredits = useBuyCredits();
  const offer = useFirstPurchaseOffer();

  function handleSwitchPlan(planKey: PlanTier) {
    checkout.mutate({ plan: planKey }, {
      onSuccess: (url) => { window.location.href = url; },
      onError:   (err) => toast.error(err.message || "Failed to start checkout"),
    });
  }

  function handleBuyPack(pack: CreditPackKey) {
    buyCredits.mutate({ pack }, {
      onSuccess: (url) => { window.location.href = url; },
      onError:   (err) => toast.error(err.message || "Failed to start checkout"),
    });
  }

  function handleManageBilling() {
    billingPortal.mutate(undefined, {
      onSuccess: (url) => { window.location.href = url; },
      onError:   (err) => toast.error(err.message || "Failed to open billing portal"),
    });
  }

  const plan = profile?.plan ?? "free";
  const planConfig = plan !== "free" ? PLANS[plan as keyof typeof PLANS] : null;
  const creditsRemaining = credits?.remaining ?? 0;
  const isUnlimitedCredits = credits?.is_unlimited === true;
  const creditsTotal = planConfig?.credits ?? 0;
  const creditPercent = isUnlimitedCredits
    ? 100
    : creditsTotal > 0
      ? Math.min(100, Math.round((creditsRemaining / creditsTotal) * 100))
      : 0;
  const isLowCredits = !isUnlimitedCredits && creditsRemaining <= 5 && plan === "free";
  const isLoading = creditsLoading || profileLoading || subLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/settings"><ArrowLeft className="size-4" /></Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 pb-12">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/settings"><ArrowLeft className="size-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage your plan, credits, and payment history.
          </p>
        </div>
      </div>

      {/* ── Credit Balance Hero ────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Credit Balance
            </p>
            <div className="flex items-end gap-2">
              <span className="text-5xl font-bold tracking-tight text-foreground">
                {isUnlimitedCredits ? "∞" : creditsRemaining}
              </span>
              {!isUnlimitedCredits && (
                <span className="mb-1 text-lg text-muted-foreground">
                  {creditsTotal > 0 ? `/ ${creditsTotal}` : "credits"}
                </span>
              )}
            </div>
            {planConfig && !isUnlimitedCredits && (
              <p className="text-sm text-muted-foreground">
                {creditsTotal - creditsRemaining} used · resets on next billing cycle
              </p>
            )}
            {plan === "free" && !isUnlimitedCredits && (
              <p className="text-sm text-muted-foreground">
                One-time free credits · buy a pack or subscribe to get more
              </p>
            )}
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("text-xs", subscription ? (statusColors[subscription.status] ?? statusColors.incomplete) : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20")}>
                {planConfig?.name ?? "Free"} plan
              </Badge>
              {subscription?.current_period_end && (
                <span className="text-xs text-muted-foreground">
                  renews {formatDate(subscription.current_period_end)}
                </span>
              )}
            </div>
            {subscription && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleManageBilling}
                disabled={billingPortal.isPending}
              >
                {billingPortal.isPending
                  ? <Loader2 className="size-4 animate-spin" />
                  : <><CreditCard className="size-4" /> Manage Billing <ArrowUpRight className="size-3.5" /></>
                }
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar - only for subscribed users */}
        {plan !== "free" && !isUnlimitedCredits && creditsTotal > 0 && (
          <div className="mt-5">
            <Progress
              value={creditPercent}
              className="h-2 bg-muted [&>[data-slot=progress-indicator]]:bg-primary"
            />
          </div>
        )}

        {/* Low-credit warning */}
        {isLowCredits && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-400" />
            <p className="text-sm text-amber-300">
              You&apos;re out of credits. Pick a plan below or top up with a one-time pack to keep generating.
            </p>
          </div>
        )}
      </div>

      {/* ── Subscription Plans ─────────────────────────────────── */}
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Monthly Plans</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Subscribe for the best per-credit rate - always cheaper than one-time packs.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {(Object.entries(PLANS) as [PlanTier, typeof PLANS[PlanTier]][]).map(([key, p]) => {
            const isCurrent = plan === key;
            const ui = PLAN_HIGHLIGHTS[key];
            const videosStandard = Math.floor(p.credits / 5);
            const videosHd = Math.floor(p.credits / 10);
            const tripleStandard = Math.floor(p.credits / 15);
            const combosTriple = tripleStandard * 27;

            return (
              <div
                key={key}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-6 transition-all duration-200",
                  ui.highlighted
                    ? "border-primary/40 bg-card shadow-[0_0_40px_rgba(249,115,22,0.07)]"
                    : "border-border bg-card hover:border-primary/30"
                )}
              >
                {/* Most Popular badge */}
                {ui.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">
                      {ui.badge}
                    </span>
                  </div>
                )}

                {/* Plan name + current badge */}
                <div className="mb-4 flex items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">{p.name}</h3>
                  {isCurrent && (
                    <Badge variant="secondary" className="text-xs">
                      Current
                    </Badge>
                  )}
                </div>

                {/* Price */}
                <div className="mb-1 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">
                    ${offer.isActive ? offer.discountedPrice(p.price) : p.price}
                  </span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
                {offer.isActive && (
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    <span className="line-through text-muted-foreground">${p.price}/mo</span>
                    <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-md text-xs font-bold">-30%</span>
                  </div>
                )}
                <p className="mb-5 text-xs text-primary">
                  ${(p.price / p.credits).toFixed(2)}/credit
                </p>

                {/* Features */}
                <ul className="mb-6 flex flex-1 flex-col gap-2.5">
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="size-3.5 shrink-0 text-primary" strokeWidth={2.5} />
                    <strong className="text-foreground">{p.credits} credits</strong>/month
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="size-3.5 shrink-0 text-primary" strokeWidth={2.5} />
                    {videosStandard} standard or {videosHd} HD videos
                  </li>
                  {tripleStandard > 0 && (
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="size-3.5 shrink-0 text-emerald-400" strokeWidth={2.5} />
                      Up to <strong className="text-foreground ml-0.5">{combosTriple} ad combos</strong>
                    </li>
                  )}
                  {p.features.slice(2).map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="size-3.5 shrink-0 text-primary" strokeWidth={2.5} />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent ? (
                  <div className="w-full rounded-full border border-primary/30 py-2.5 text-center text-sm font-medium text-primary">
                    Current Plan
                  </div>
                ) : (
                  <button
                    onClick={() => handleSwitchPlan(key)}
                    disabled={checkout.isPending}
                    className={cn(
                      "w-full rounded-full py-2.5 text-sm font-medium transition-all duration-200 disabled:opacity-60",
                      ui.highlighted
                        ? "bg-primary text-white hover:bg-orange-600"
                        : "border border-border text-foreground hover:border-primary/40"
                    )}
                  >
                    {checkout.isPending
                      ? <Loader2 className="mx-auto size-4 animate-spin" />
                      : ui.ctaLabel
                    }
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Cancel anytime · No contracts · Credits refresh monthly
        </p>
      </div>

      {/* ── One-time Credit Packs ──────────────────────────────── */}
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Top Up Credits</h2>
          <p className="mt-1 text-sm text-muted-foreground">
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
                  <span className="text-3xl font-bold text-foreground">
                    ${offer.isActive ? offer.discountedPrice(pack.price) : pack.price}
                  </span>
                </div>
                {offer.isActive && (
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    <span className="line-through text-muted-foreground">${pack.price}</span>
                    <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-md text-xs font-bold">-30%</span>
                  </div>
                )}
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

                <button
                  onClick={() => handleBuyPack(key)}
                  disabled={buyCredits.isPending}
                  className={cn(
                    "w-full rounded-full py-2.5 text-sm font-medium transition-all duration-200 disabled:opacity-60",
                    isBestValue
                      ? "bg-primary text-white hover:bg-orange-600"
                      : "border border-border text-foreground hover:border-primary/40"
                  )}
                >
                  {buyCredits.isPending
                    ? <Loader2 className="mx-auto size-4 animate-spin" />
                    : "Buy Now"
                  }
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── How Credits Work ──────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-5 text-base font-semibold tracking-tight">How credits work</h2>

        <div className="grid gap-5 sm:grid-cols-3">
          {/* Standard */}
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

          {/* HD */}
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

          {/* Triple */}
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

        {/* Triple callout */}
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

      {/* ── Active Subscription Details ───────────────────────── */}
      {subscription && subscription.status === "active" && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              {planConfig?.name} subscription
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {subscription.current_period_end
                ? `Next billing date: ${formatDate(subscription.current_period_end)}`
                : "Active subscription"
              }
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
            onClick={() => setShowCancelDialog(true)}
          >
            Cancel Plan
          </Button>
        </div>
      )}

      <Separator />

      {/* ── Credit History ────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold tracking-tight">Credit History</h2>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {ledgerLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : !ledger || ledger.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="text-sm text-muted-foreground">No credit history yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Type</th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((entry) => {
                    const config = reasonLabels[entry.reason] ?? { label: entry.reason, color: "text-foreground" };
                    return (
                      <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3 text-sm text-muted-foreground">{formatDate(entry.created_at)}</td>
                        <td className="px-5 py-3">
                          <Badge variant="secondary" className="text-xs">{config.label}</Badge>
                        </td>
                        <td className={cn("px-5 py-3 text-right text-sm font-semibold tabular-nums", config.color)}>
                          {entry.amount > 0 ? "+" : ""}{entry.amount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Cancel Dialog ─────────────────────────────────────── */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription?</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your {planConfig?.name ?? ""} plan?
              {subscription?.current_period_end &&
                ` You will retain access until ${formatDate(subscription.current_period_end)}, but unused credits will not carry over.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCancelDialog(false)}>
              Keep Plan
            </Button>
            <Button variant="destructive" onClick={() => { handleManageBilling(); setShowCancelDialog(false); }}>
              Manage in Stripe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
