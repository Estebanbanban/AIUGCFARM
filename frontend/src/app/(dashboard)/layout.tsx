import { DashboardShell } from "@/components/layout/DashboardShell";
import { OnboardingOverlay } from "@/components/onboarding/OnboardingOverlay";
import { FirstVideoDiscountBanner } from "@/components/landing/FirstVideoDiscountBanner";
import { OfferCountdownBanner } from "@/components/offers/OfferCountdownBanner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <FirstVideoDiscountBanner />
      <OfferCountdownBanner />
      <OnboardingOverlay />
      <DashboardShell>{children}</DashboardShell>
    </>
  );
}
