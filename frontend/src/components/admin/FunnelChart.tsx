"use client";

import { useRouter } from "next/navigation";

interface FunnelStep {
  step: string;
  count: number;
  pct: number;
}

interface Props {
  data: FunnelStep[];
  period: string;
}

const PERIOD_OPTIONS = [
  { label: "7 jours", value: "7" },
  { label: "30 jours", value: "30" },
  { label: "90 jours", value: "90" },
  { label: "All time", value: "all" },
];

export function FunnelChart({ data, period }: Props) {
  const router = useRouter();
  const maxCount = data[0]?.count ?? 1;

  function dropoffColor(pct: number) {
    if (pct > 70) return "text-emerald-500";
    if (pct > 40) return "text-yellow-500";
    return "text-red-500";
  }

  function barColor(pct: number) {
    if (pct > 70) return "bg-emerald-500";
    if (pct > 40) return "bg-yellow-500";
    return "bg-red-500";
  }

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex flex-wrap gap-2">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => router.push(`/admin/funnel?period=${opt.value}`)}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              period === opt.value
                ? "bg-primary text-primary-foreground font-medium"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Funnel steps */}
      <div className="space-y-3">
        {data.map((step, i) => {
          const prev = data[i - 1];
          const dropoff = prev ? prev.pct - step.pct : 0;

          return (
            <div key={step.step} className="space-y-1.5">
              {i > 0 && dropoff > 0 && (
                <div className="flex items-center gap-2 pl-4">
                  <div className="w-px h-4 bg-border" />
                  <span className={`text-xs font-medium ${dropoffColor(step.pct)}`}>
                    ▼ -{dropoff}%
                  </span>
                </div>
              )}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-foreground">{step.step}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-foreground">{step.count.toLocaleString()}</span>
                    <span className={`text-sm font-bold ${dropoffColor(step.pct)}`}>{step.pct}%</span>
                  </div>
                </div>
                <div className="h-2.5 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor(step.pct)}`}
                    style={{ width: `${step.pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {data.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Résumé</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-bold text-foreground">{data[0]?.count ?? 0}</p>
              <p className="text-xs text-muted-foreground">Signups</p>
            </div>
            <div>
              <p className="text-xl font-bold text-primary">{data[data.length - 1]?.count ?? 0}</p>
              <p className="text-xs text-muted-foreground">Convertis</p>
            </div>
            <div className="col-span-2 md:col-span-1">
              <p className="text-xl font-bold text-foreground">{data[data.length - 1]?.pct ?? 0}%</p>
              <p className="text-xs text-muted-foreground">Taux end-to-end</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
