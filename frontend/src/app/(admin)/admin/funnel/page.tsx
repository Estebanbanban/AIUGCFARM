import { getFunnelData } from "@/lib/admin/queries";
import { FunnelChart } from "@/components/admin/FunnelChart";

export const dynamic = "force-dynamic";

export default async function FunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period = params.period ?? "30";
  const days = period === "all" ? null : Number(period);

  const funnelData = await getFunnelData(days);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Funnel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Taux de conversion à chaque étape du parcours utilisateur
        </p>
      </div>
      <FunnelChart data={funnelData} period={period} />
    </div>
  );
}
