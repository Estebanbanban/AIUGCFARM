"use client";

export const dynamic = "force-dynamic";

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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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

const reasonLabels: Record<string, { label: string; color: string }> = {
  generation: { label: "Generation", color: "text-red-400" },
  subscription_renewal: { label: "Credit Grant", color: "text-emerald-400" },
  subscription_purchase: { label: "Credit Grant", color: "text-emerald-400" },
  credit_pack_purchase: { label: "Pack Purchase", color: "text-emerald-400" },
  refund: { label: "Refund", color: "text-primary" },
  bonus: { label: "Bonus", color: "text-primary" },
  free_trial: { label: "Free Trial", color: "text-amber-400" },
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400",
  past_due: "bg-amber-500/10 text-amber-400",
  canceled: "bg-red-500/10 text-red-400",
  incomplete: "bg-zinc-500/10 text-zinc-400",
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

  function handleSwitchPlan(planKey: PlanTier) {
    checkout.mutate({ plan: planKey }, {
      onSuccess: (url) => { window.location.href = url; },
      onError: (err) => toast.error(err.message || "Failed to start checkout"),
    });
  }

  function handleBuyPack(pack: CreditPackKey) {
    buyCredits.mutate({ pack }, {
      onSuccess: (url) => { window.location.href = url; },
      onError: (err) => toast.error(err.message || "Failed to start checkout"),
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

  const isLoading = creditsLoading || profileLoading || subLoading;

  function handleManageBilling() {
    billingPortal.mutate(undefined, {
      onSuccess: (url) => { window.location.href = url; },
      onError: (err) => { toast.error(err.message || "Failed to open billing portal"); },
    });
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/settings">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Billing & Credits
            </h1>
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-32 animate-pulse bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/settings">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Billing & Credits
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage your plan, credits, and payment history.
          </p>
        </div>
      </div>

      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>
                {subscription?.current_period_end
                  ? `Next billing date: ${formatDate(subscription.current_period_end)}`
                  : plan === "free"
                    ? "No active subscription — buy credits to start generating"
                    : "No active subscription"}
              </CardDescription>
            </div>
            {subscription && (
              <Badge className={statusColors[subscription.status] ?? statusColors.incomplete}>
                {subscription.status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                <CreditCard className="size-6 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">
                  {planConfig?.name ?? "Free"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {planConfig ? `$${planConfig.price}/mo` : "No subscription"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {subscription ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManageBilling}
                  disabled={billingPortal.isPending}
                >
                  {billingPortal.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      Manage Billing
                      <ArrowUpRight className="size-4" />
                    </>
                  )}
                </Button>
              ) : (
                <Button asChild size="sm">
                  <Link href="/pricing">View Plans</Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credit Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Credit Balance</CardTitle>
          <CardDescription>
            {isUnlimitedCredits
              ? "Unlimited credits (admin access)"
              : plan !== "free"
                ? `${creditsRemaining} of ${creditsTotal} credits remaining this month`
                : `${creditsRemaining} credits remaining`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {plan !== "free" && (
            <Progress
              value={creditPercent}
              className="h-3 bg-muted [&>[data-slot=progress-indicator]]:bg-primary"
            />
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {isUnlimitedCredits
                ? "Usage is not capped for admin accounts"
                : plan !== "free"
                  ? `${creditsTotal - creditsRemaining} used`
                  : "1 credit = $1 value"}
            </span>
            <span className="font-medium text-foreground">
              {isUnlimitedCredits ? "Unlimited" : plan !== "free" ? `${creditPercent}%` : `${creditsRemaining} cr`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* How credits work */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-base font-semibold">How credits work</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <Film className="size-4 text-primary" />
              </div>
              <span className="text-sm font-medium">Standard video</span>
            </div>
            <p className="text-xs text-muted-foreground">
              5 credits = 1 complete ad (hook + body + CTA) using Kling v2.6.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="size-4 text-primary" />
              </div>
              <span className="text-sm font-medium">HD video</span>
            </div>
            <p className="text-xs text-muted-foreground">
              10 credits = 1 complete HD ad using Kling v3 (sharper, more cinematic).
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <Layers className="size-4 text-emerald-400" />
              </div>
              <span className="text-sm font-medium">Triple mode</span>
            </div>
            <p className="text-xs text-muted-foreground">
              15 credits = 3 hooks × 3 bodies × 3 CTAs = <strong className="text-foreground">27 unique ad combos</strong>.
              That&apos;s $0.56/combo — same creative budget, 27× the A/B testing power.
            </p>
          </div>
        </div>

        {/* Triple mode explainer */}
        <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-1">
            Why Triple Mode is the smart choice
          </p>
          <p className="text-sm text-muted-foreground">
            One 15-credit Triple batch generates 3 different hooks, 3 different bodies, and 3 different CTAs.
            Export them all — you get <strong className="text-foreground">27 mix-and-match video combinations</strong> from a single generation.
            Run them across TikTok, Reels, and Shorts to find your winning creative in days, not weeks.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="rounded-md bg-card px-2 py-1 border border-border">15 cr → 27 combos</span>
            <span className="rounded-md bg-card px-2 py-1 border border-border">$0.56/combo (standard)</span>
            <span className="rounded-md bg-card px-2 py-1 border border-border">vs $5/single video</span>
          </div>
        </div>
      </div>

      {/* Buy Credits (one-time packs) */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Buy Credits</h2>
          <p className="text-sm text-muted-foreground">
            One-time top-up, no subscription required. Credits never expire.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {(Object.entries(CREDIT_PACKS) as [CreditPackKey, (typeof CREDIT_PACKS)[CreditPackKey]][]).map(([key, pack]) => {
            const videosStandard = Math.floor(pack.credits / 5);
            const videosHd = Math.floor(pack.credits / 10);
            const tripleStandard = Math.floor(pack.credits / 15);
            const combosTriple = tripleStandard * 27;
            return (
              <Card key={key} className={cn("badge" in pack && pack.badge === "Best value" && "border-primary/40 ring-1 ring-primary/20")}>
                <CardContent className="flex flex-col gap-4 p-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{pack.name}</h3>
                      {"badge" in pack && pack.badge && (
                        <Badge variant="secondary" className={cn("text-xs", pack.badge === "Best value" && "bg-primary/10 text-primary")}>
                          {pack.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-3xl font-bold">${pack.price}</p>
                    <p className="text-xs text-muted-foreground">${pack.pricePerCredit}/credit</p>
                  </div>
                  <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 shrink-0 text-primary" />
                      {pack.credits} credits
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 shrink-0 text-primary" />
                      {videosStandard} standard videos or {videosHd} HD videos
                    </li>
                    {tripleStandard > 0 && (
                      <li className="flex items-center gap-2">
                        <Check className="size-3.5 shrink-0 text-emerald-400" />
                        <span>
                          {tripleStandard} Triple batch{tripleStandard > 1 ? "es" : ""} = <strong className="text-foreground">{combosTriple} ad combos</strong>
                        </span>
                      </li>
                    )}
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 shrink-0 text-primary" />
                      Credits never expire
                    </li>
                  </ul>
                  <Button
                    variant={("badge" in pack && pack.badge === "Best value") ? "default" : "outline"}
                    size="sm"
                    className="mt-auto"
                    onClick={() => handleBuyPack(key)}
                    disabled={buyCredits.isPending}
                  >
                    {buyCredits.isPending ? <Loader2 className="size-4 animate-spin" /> : "Buy Now"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Plan Comparison */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Monthly Plans</h2>
          <p className="text-sm text-muted-foreground">
            Subscribe for the best per-credit rate — always cheaper than packs.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {(Object.entries(PLANS) as [PlanTier, typeof PLANS[PlanTier]][]).map(([key, p]) => {
            const isCurrent = plan === key;
            const videosStandard = Math.floor(p.credits / 5);
            const videosHd = Math.floor(p.credits / 10);
            const tripleStandard = Math.floor(p.credits / 15);
            const combosTriple = tripleStandard * 27;
            return (
              <Card
                key={key}
                className={cn(isCurrent && "border-primary/50 ring-1 ring-primary/20")}
              >
                <CardContent className="flex flex-col gap-4 p-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{p.name}</h3>
                      {isCurrent && (
                        <Badge variant="secondary" className="text-xs">Current</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-2xl font-bold">${p.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                    <p className="text-xs text-muted-foreground">${(p.price / p.credits).toFixed(2)}/credit</p>
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="size-3.5 shrink-0 text-primary" />
                      {p.credits} credits/month
                    </li>
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="size-3.5 shrink-0 text-primary" />
                      {videosStandard} standard or {videosHd} HD videos
                    </li>
                    {tripleStandard > 0 && (
                      <li className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="size-3.5 shrink-0 text-emerald-400" />
                        <span>Up to <strong className="text-foreground">{combosTriple} ad combos</strong> via Triple mode</span>
                      </li>
                    )}
                    {p.features.slice(2).map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="size-3.5 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {!isCurrent && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-auto"
                      onClick={() => handleSwitchPlan(key)}
                      disabled={checkout.isPending}
                    >
                      {checkout.isPending ? <Loader2 className="size-4 animate-spin" /> : `Switch to ${p.name}`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Cancel Subscription */}
      {subscription && subscription.status === "active" && (
        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Cancel Subscription
            </p>
            <p className="text-xs text-muted-foreground">
              Your access continues until the end of the billing period.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
            onClick={() => setShowCancelDialog(true)}
          >
            Cancel Plan
          </Button>
        </div>
      )}

      <Separator />

      {/* Credit History */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Credit History</h2>

        <Card>
          <CardContent className="p-0">
            {ledgerLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : !ledger || ledger.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No credit history yet
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                        Type
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((entry) => {
                      const config = reasonLabels[entry.reason] ?? {
                        label: entry.reason,
                        color: "text-foreground",
                      };
                      return (
                        <tr
                          key={entry.id}
                          className="border-b border-border last:border-0"
                        >
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {formatDate(entry.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="text-xs">
                              {config.label}
                            </Badge>
                          </td>
                          <td
                            className={`px-4 py-3 text-right text-sm font-medium ${config.color}`}
                          >
                            {entry.amount > 0 ? "+" : ""}
                            {entry.amount}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cancel Dialog */}
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
            <Button
              variant="secondary"
              onClick={() => setShowCancelDialog(false)}
            >
              Keep Plan
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                handleManageBilling();
                setShowCancelDialog(false);
              }}
            >
              Manage in Stripe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
