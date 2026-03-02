import { DashboardShell } from "@/components/layout/DashboardShell";
import { OnboardingOverlay } from "@/components/onboarding/OnboardingOverlay";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <OnboardingOverlay />
      <DashboardShell>{children}</DashboardShell>
    </>
  );
}
