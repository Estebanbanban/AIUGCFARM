import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="size-8 animate-spin text-primary" />
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
