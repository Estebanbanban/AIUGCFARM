"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CreditCard,
  Loader2,
  AlertTriangle,
} from "lucide-react";
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
import { formatDate } from "@/lib/utils";

const mockSubscription = {
  tier: "growth",
  tierLabel: "Growth",
  price: "$79/mo",
  status: "active" as const,
  currentPeriodEnd: "2026-03-15T00:00:00Z",
  creditsUsed: 18,
  creditsTotal: 27,
  cancelAtPeriodEnd: false,
};

const mockTransactions = [
  {
    id: "txn-1",
    date: "2026-02-24",
    type: "generation_debit" as const,
    description: "Vitamin C Serum batch (9 segments)",
    amount: -9,
    balanceAfter: 18,
  },
  {
    id: "txn-2",
    date: "2026-02-22",
    type: "generation_debit" as const,
    description: "Protein Shake batch (9 segments)",
    amount: -9,
    balanceAfter: 27,
  },
  {
    id: "txn-3",
    date: "2026-02-20",
    type: "refund_credit" as const,
    description: "Refund for failed segment",
    amount: 1,
    balanceAfter: 36,
  },
  {
    id: "txn-4",
    date: "2026-02-15",
    type: "subscription_grant" as const,
    description: "Growth plan monthly credits",
    amount: 27,
    balanceAfter: 35,
  },
  {
    id: "txn-5",
    date: "2026-02-14",
    type: "generation_debit" as const,
    description: "Running Shoes batch (8 segments)",
    amount: -8,
    balanceAfter: 8,
  },
];

const transactionTypeLabels: Record<string, { label: string; color: string }> =
  {
    generation_debit: { label: "Generation", color: "text-red-400" },
    subscription_grant: { label: "Credit Grant", color: "text-emerald-400" },
    refund_credit: { label: "Refund", color: "text-blue-400" },
    overage_debit: { label: "Overage", color: "text-amber-400" },
  };

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400",
  past_due: "bg-amber-500/10 text-amber-400",
  canceled: "bg-red-500/10 text-red-400",
  trialing: "bg-blue-500/10 text-blue-400",
};

export default function BillingPage() {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isManaging, setIsManaging] = useState(false);

  const creditPercent = Math.round(
    (mockSubscription.creditsUsed / mockSubscription.creditsTotal) * 100
  );
  const creditsRemaining =
    mockSubscription.creditsTotal - mockSubscription.creditsUsed;

  function handleManageBilling() {
    setIsManaging(true);
    // Would redirect to Stripe Customer Portal
    setTimeout(() => setIsManaging(false), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/dashboard/settings">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
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
              <CardTitle className="text-foreground">Current Plan</CardTitle>
              <CardDescription>
                Next billing date:{" "}
                {formatDate(mockSubscription.currentPeriodEnd)}
              </CardDescription>
            </div>
            <Badge className={statusColors[mockSubscription.status]}>
              {mockSubscription.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-violet-500/10">
                <CreditCard className="size-6 text-violet-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">
                  {mockSubscription.tierLabel}
                </p>
                <p className="text-sm text-muted-foreground">
                  {mockSubscription.price}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManageBilling}
                disabled={isManaging}
              >
                {isManaging ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Change Plan
                    <ArrowUpRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {mockSubscription.cancelAtPeriodEnd && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-4 py-2 text-sm text-amber-400">
              <AlertTriangle className="size-4" />
              Your subscription will cancel at the end of the current period.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Credit Usage</CardTitle>
          <CardDescription>
            {creditsRemaining} of {mockSubscription.creditsTotal} credits
            remaining this month
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Progress
            value={creditPercent}
            className="h-3 bg-muted [&>[data-slot=progress-indicator]]:bg-violet-500"
          />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {mockSubscription.creditsUsed} used
            </span>
            <span className="font-medium text-foreground">
              {creditPercent}%
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Cancel Subscription */}
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

      <Separator />

      {/* Transaction History */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">
          Credit History
        </h2>

        <Card>
          <CardContent className="p-0">
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
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                      Description
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mockTransactions.map((txn) => {
                    const typeConfig = transactionTypeLabels[txn.type];
                    return (
                      <tr
                        key={txn.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(txn.date)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="secondary"
                            className="text-xs"
                          >
                            {typeConfig.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {txn.description}
                        </td>
                        <td
                          className={`px-4 py-3 text-right text-sm font-medium ${typeConfig.color}`}
                        >
                          {txn.amount > 0 ? "+" : ""}
                          {txn.amount}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-foreground">
                          {txn.balanceAfter}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription?</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your {mockSubscription.tierLabel}{" "}
              plan? You will retain access until{" "}
              {formatDate(mockSubscription.currentPeriodEnd)}, but unused
              credits will not carry over.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
            >
              Keep Plan
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowCancelDialog(false)}
            >
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
