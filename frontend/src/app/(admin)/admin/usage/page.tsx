import nextDynamic from "next/dynamic";
import { getGenerationTimeseries, getGenerationStats, getProductSourceBreakdown, getApiCostStats } from "@/lib/admin/queries";
import { StatCard } from "@/components/admin/StatCard";

const GenerationsLineChart = nextDynamic(
  () => import("@/components/admin/UsageCharts").then((m) => m.GenerationsLineChart),
  { loading: () => <div className="h-[200px] w-full animate-pulse rounded-lg bg-muted" /> },
);
const StatusPieChart = nextDynamic(
  () => import("@/components/admin/UsageCharts").then((m) => m.StatusPieChart),
  { loading: () => <div className="h-[200px] w-full animate-pulse rounded-lg bg-muted" /> },
);
const SourcePieChart = nextDynamic(
  () => import("@/components/admin/UsageCharts").then((m) => m.SourcePieChart),
  { loading: () => <div className="h-[200px] w-full animate-pulse rounded-lg bg-muted" /> },
);

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const [timeseries, stats, sourceBreakdown, apiCost] = await Promise.all([
    getGenerationTimeseries(30),
    getGenerationStats(),
    getProductSourceBreakdown(),
    getApiCostStats(),
  ]);

  const statusData = [
    { name: "Succès", value: stats.completed },
    { name: "Échecs", value: stats.failed },
    { name: "Autres", value: stats.pending },
  ];

  const avgMin = Math.floor(stats.avgDurationSec / 60);
  const avgSec = stats.avgDurationSec % 60;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Usage</h1>
        <p className="text-sm text-muted-foreground mt-1">Générations et activité produit</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Total générations" value={stats.total.toLocaleString()} />
        <StatCard label="Taux de succès" value={`${stats.successRate}%`} accent={stats.successRate > 80} />
        <StatCard label="Taux d'échec" value={`${stats.total ? Math.round((stats.failed / stats.total) * 100) : 0}%`} />
        <StatCard label="Durée moyenne" value={`${avgMin}m ${avgSec}s`} sub="Par génération" />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Coûts API Kling (vidéo générée)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            label="Coût total API"
            value={`$${apiCost.totalCostUsd.toFixed(2)}`}
            sub={`${apiCost.count} générations complètes`}
          />
          <StatCard
            label="Coût moyen / vidéo"
            value={`$${apiCost.avgCostUsd.toFixed(3)}`}
            sub="Par génération complète"
          />
          <StatCard
            label="Secondes facturées"
            value={`${apiCost.totalBilledSeconds.toLocaleString()}s`}
            sub="Total cumulé"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-medium text-foreground mb-4">Générations / jour - 30 derniers jours</p>
        <GenerationsLineChart data={timeseries} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-medium text-foreground mb-4">Statut des générations</p>
          <StatusPieChart data={statusData} />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-medium text-foreground mb-4">Source des produits</p>
          <SourcePieChart data={sourceBreakdown} />
        </div>
      </div>
    </div>
  );
}
