import { Suspense } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { OnboardingOverlay } from "@/components/onboarding/OnboardingOverlay";
import { OfferBanner } from "@/components/dashboard/OfferBanner";
import { CheckoutSuccessHandler } from "@/components/checkout/CheckoutSuccessHandler";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <OfferBanner />
      <OnboardingOverlay />
      <Suspense>
        <CheckoutSuccessHandler />
      </Suspense>
      <DashboardShell>{children}</DashboardShell>
    </>
  );
}
