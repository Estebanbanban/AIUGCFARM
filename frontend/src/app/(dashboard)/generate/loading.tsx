import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header skeleton */}
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />

      {/* Steps skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-2 flex-1 animate-pulse rounded-full bg-muted" />
        ))}
      </div>

      {/* Card skeleton */}
      <div className="rounded-2xl border border-border bg-card p-8">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </div>
    </div>
  );
}
