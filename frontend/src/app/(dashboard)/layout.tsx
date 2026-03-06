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

    // Refresh session when the user comes back to the tab after inactivity.
    // Browsers throttle/kill background JS timers, which can prevent Supabase's
    // auto-refresh ticker from firing and let the access token expire silently.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        supabase.auth.getUser(); // triggers a token refresh if the access token is expired
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
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
