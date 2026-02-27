interface Metric {
  value: string;
  label: string;
}

interface BlogMetricsProps {
  metrics: Metric[];
}

export function BlogMetrics({ metrics }: BlogMetricsProps) {
  return (
    <div className="my-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-xl border border-border p-4 text-center"
        >
          <p className="text-3xl font-bold text-primary">{metric.value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{metric.label}</p>
        </div>
      ))}
    </div>
  );
}
