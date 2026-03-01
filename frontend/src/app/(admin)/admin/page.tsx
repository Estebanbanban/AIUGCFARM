import { getOverviewStats, getSignupTimeseries } from "@/lib/admin/queries";
import { StatCard } from "@/components/admin/StatCard";
import { OverviewChart } from "@/components/admin/OverviewChart";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [stats, timeseries] = await Promise.all([
    getOverviewStats(),
    getSignupTimeseries(30),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Métriques clés en temps réel</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        <StatCard
          label="MRR"
          value={`$${stats.mrr.toLocaleString()}`}
          sub="Abonnements actifs"
          accent
        />
        <StatCard
          label="ARR"
          value={`$${stats.arr.toLocaleString()}`}
          sub="Projection annuelle"
        />
        <StatCard
          label="Total Users"
          value={stats.totalUsers.toLocaleString()}
          sub={`+${stats.newThisMonth} ce mois`}
        />
        <StatCard
          label="Nouveaux ce mois"
          value={stats.newThisMonth.toLocaleString()}
          sub="Inscriptions"
        />
        <StatCard
          label="Générations aujourd'hui"
          value={stats.genToday.toLocaleString()}
          sub="Vidéos générées"
        />
        <StatCard
          label="Taux conversion"
          value={`${stats.conversionRate}%`}
          sub="free → paid"
          accent={stats.conversionRate > 5}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground mb-4">Nouvelles inscriptions — 30 derniers jours</p>
        <OverviewChart data={timeseries} />
      </div>
    </div>
  );
}
