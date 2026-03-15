"use client";

import { Suspense } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { OfferBanner } from "@/components/dashboard/OfferBanner";
import { CheckoutSuccessHandler } from "@/components/checkout/CheckoutSuccessHandler";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <OfferBanner />
      <Suspense>
        <CheckoutSuccessHandler />
      </Suspense>
      <DashboardShell className="flex-1 min-h-0">{children}</DashboardShell>
    </div>
  );
}
