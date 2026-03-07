"use client";

import { Suspense, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { OnboardingOverlay } from "@/components/onboarding/OnboardingOverlay";
import { OfferBanner } from "@/components/dashboard/OfferBanner";
import { CheckoutSuccessHandler } from "@/components/checkout/CheckoutSuccessHandler";
import { useGenerationWizardStore } from "@/stores/generation-wizard";
import { useRouter } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || !isSignedIn) return null;

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
