import nextDynamic from "next/dynamic";
import {
  getMRRBreakdown,
  getChurnThisMonth,
  getRecentSubscriptions,
  getOneTimeRevenue,
  getOverviewStats,
} from "@/lib/admin/queries";
import { StatCard } from "@/components/admin/StatCard";

const RevenueChart = nextDynamic(
  () => import("@/components/admin/RevenueChart").then((m) => m.RevenueChart),
  { loading: () => <div className="h-[180px] w-full animate-pulse rounded-lg bg-muted" /> },
);

export const dynamic = "force-dynamic";

const PLAN_LABEL: Record<string, string> = {
  starter: "Starter - $25",
  growth: "Growth - $80",
  scale: "Scale - $180",
};

export default async function RevenuePage() {
  const [stats, breakdown, churn, recentSubs, oneTime] = await Promise.all([
    getOverviewStats(),
    getMRRBreakdown(),
    getChurnThisMonth(),
    getRecentSubscriptions(20),
    getOneTimeRevenue(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Revenue</h1>
        <p className="text-sm text-muted-foreground mt-1">MRR, ARR et churn</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="MRR" value={`$${stats.mrr.toLocaleString()}`} accent />
        <StatCard label="ARR" value={`$${stats.arr.toLocaleString()}`} />
        <StatCard
          label="Churn ce mois"
          value={churn.count}
          sub={`$${churn.mrrLost} MRR perdu`}
        />
        <StatCard
          label="One-time (packs)"
          value={`$${oneTime}`}
          sub="Ce mois"
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground mb-4">Breakdown MRR par plan</p>
        <RevenueChart data={breakdown} />
        <div className="grid grid-cols-3 gap-3 mt-4">
          {breakdown.map((b) => (
            <div key={b.plan} className="rounded-lg border border-border p-3 text-center">
              <p className="text-xs text-muted-foreground capitalize">{b.plan}</p>
              <p className="text-lg font-bold text-foreground">{b.users}</p>
              <p className="text-xs text-primary">${b.mrr}/mo</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="text-sm font-medium text-foreground">Derniers abonnements</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Email</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Plan</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Statut</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {(recentSubs as any[]).map((s) => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3 text-foreground">{(s.profiles as any)?.email ?? "-"}</td>
                  <td className="px-5 py-3 text-muted-foreground capitalize">{s.plan}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      s.status === "active" ? "bg-emerald-500/10 text-emerald-500" :
                      s.status === "canceled" ? "bg-red-500/10 text-red-500" :
                      "bg-yellow-500/10 text-yellow-500"
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground text-xs">
                    {new Date(s.created_at).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
