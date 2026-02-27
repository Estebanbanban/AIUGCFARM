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
import { PLANS, type PlanTier } from "@/lib/stripe";
import { useCredits } from "@/hooks/use-credits";
import { useProfile } from "@/hooks/use-profile";
import { useSubscription, useCreditLedger } from "@/hooks/use-billing";
import { useBillingPortal, useCheckout } from "@/hooks/use-checkout";

const reasonLabels: Record<string, { label: string; color: string }> = {
  generation: { label: "Generation", color: "text-red-400" },
  subscription_renewal: { label: "Credit Grant", color: "text-emerald-400" },
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

  function handleSwitchPlan(planKey: PlanTier) {
    checkout.mutate(planKey, {
      onSuccess: (url) => { window.location.href = url; },
      onError: (err) => toast.error(err.message || "Failed to start checkout"),
    });
  }

  const plan = profile?.plan ?? "free";
  const planConfig = plan !== "free" ? PLANS[plan as keyof typeof PLANS] : null;
  const creditsRemaining = credits?.remaining ?? 0;
  const creditsTotal = planConfig?.credits ?? 9;
  const creditPercent =
    creditsTotal > 0
      ? Math.round((creditsRemaining / creditsTotal) * 100)
      : 0;

  const isLoading = creditsLoading || profileLoading || subLoading;

  function handleManageBilling() {
    billingPortal.mutate(undefined, {
      onSuccess: (url) => {
        window.location.href = url;
      },
      onError: (err) => {
        toast.error(err.message || "Failed to open billing portal");
      },
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
              Billing & Subscription
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
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/settings">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Billing & Subscription
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
                    ? "Free plan, no billing"
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
                  <Link href="/pricing">Choose a Plan</Link>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credit Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Credit Usage</CardTitle>
          <CardDescription>
            {creditsRemaining} of {creditsTotal} credits remaining this month
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Progress
            value={creditPercent}
            className="h-3 bg-muted [&>[data-slot=progress-indicator]]:bg-primary"
          />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {creditsTotal - creditsRemaining} used
            </span>
            <span className="font-medium text-foreground">{creditPercent}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Available Plans</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {(Object.entries(PLANS) as [PlanTier, typeof PLANS[PlanTier]][]).map(([key, p]) => {
            const isCurrent = plan === key;
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
                    <p className="mt-1 text-2xl font-bold">${p.price}/mo</p>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {p.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="size-3.5 text-primary" />
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
