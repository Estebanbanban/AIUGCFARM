interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: { value: number; label: string };
  accent?: boolean;
}

export function StatCard({ label, value, sub, trend, accent }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-1 ${accent ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <p className="text-xs text-muted-foreground uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      {trend && (
        <p className={`text-xs font-medium mt-1 ${trend.value >= 0 ? "text-emerald-500" : "text-red-500"}`}>
          {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
        </p>
      )}
    </div>
  );
}
