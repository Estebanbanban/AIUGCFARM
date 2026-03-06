"use client";

import { Suspense, useEffect } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { OnboardingOverlay } from "@/components/onboarding/OnboardingOverlay";
import { OfferBanner } from "@/components/dashboard/OfferBanner";
import { CheckoutSuccessHandler } from "@/components/checkout/CheckoutSuccessHandler";
import { createClient } from "@/lib/supabase/client";
import { useGenerationWizardStore } from "@/stores/generation-wizard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "SIGNED_IN") {
        localStorage.removeItem("onboarding-skipped");
        useGenerationWizardStore.getState().reset();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <OfferBanner />
      <OnboardingOverlay />
      <Suspense>
        <CheckoutSuccessHandler />
      </Suspense>
      <DashboardShell className="flex-1 min-h-0">{children}</DashboardShell>
    </div>
  );
}
