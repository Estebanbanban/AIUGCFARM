export const dynamic = "force-dynamic";

import { DashboardShell } from "@/components/layout/DashboardShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark">
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}
