import { DashboardShell } from "@/components/layout/DashboardShell";
import { OnboardingOverlay } from "@/components/onboarding/OnboardingOverlay";
import { FirstVideoDiscountBanner } from "@/components/landing/FirstVideoDiscountBanner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <FirstVideoDiscountBanner />
      <OnboardingOverlay />
      <DashboardShell>{children}</DashboardShell>
    </>
  );
}
