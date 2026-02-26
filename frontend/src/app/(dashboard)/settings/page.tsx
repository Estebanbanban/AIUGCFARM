"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { UserProfile } from "@clerk/nextjs";
import { ArrowRight, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account and billing preferences.
        </p>
      </div>

      {/* Billing Link */}
      <Card>
        <CardContent className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10">
              <CreditCard className="size-5 text-violet-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Billing & Subscription
              </p>
              <p className="text-xs text-muted-foreground">
                Manage your plan, credits, and payment methods.
              </p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/settings/billing">
              Manage Billing
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Clerk UserProfile */}
      <div className="overflow-hidden rounded-lg">
        <UserProfile
          appearance={{
            baseTheme: undefined,
            elements: {
              rootBox: "w-full",
              cardBox: "w-full shadow-none",
              card: "bg-card border border-border shadow-none",
              headerTitle: "text-foreground",
              headerSubtitle: "text-muted-foreground",
              profileSectionTitle: "text-foreground",
              profileSectionTitleText: "text-foreground",
              profileSectionContent: "text-muted-foreground",
              formFieldLabel: "text-foreground",
              formFieldInput:
                "bg-transparent border-border text-foreground",
              formButtonPrimary: "bg-violet-600 hover:bg-violet-700",
              navbarButton: "text-muted-foreground hover:text-foreground",
              navbarButtonIcon: "text-muted-foreground",
              badge: "bg-violet-500/10 text-violet-400",
              pageScrollBox: "p-0",
              page: "gap-4",
            },
          }}
        />
      </div>
    </div>
  );
}
