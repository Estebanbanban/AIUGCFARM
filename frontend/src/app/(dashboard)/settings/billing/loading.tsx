import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-10 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-md" />
        <div>
          <Skeleton className="h-7 w-20" />
          <Skeleton className="mt-1 h-4 w-64" />
        </div>
      </div>

      {/* Credit Balance Hero */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-12 w-24" />
            <Skeleton className="h-4 w-52" />
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-8 w-36 rounded-md" />
          </div>
        </div>
        <Skeleton className="mt-5 h-2 w-full rounded-full" />
      </div>

      {/* Monthly Plans */}
      <div className="flex flex-col gap-5">
        <div>
          <Skeleton className="h-6 w-36" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col rounded-2xl border border-border p-6">
              <Skeleton className="mb-4 h-5 w-20" />
              <Skeleton className="mb-1 h-10 w-16" />
              <Skeleton className="mb-5 h-3 w-24" />
              <div className="mb-6 flex flex-col gap-2.5">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-4 w-full" />
                ))}
              </div>
              <Skeleton className="h-10 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Top Up Credits */}
      <div className="flex flex-col gap-5">
        <div>
          <Skeleton className="h-6 w-36" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col rounded-2xl border border-border p-5">
              <Skeleton className="mb-3 h-5 w-24" />
              <Skeleton className="mb-1 h-8 w-14" />
              <Skeleton className="mb-4 h-3 w-20" />
              <div className="mb-5 flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-4 w-full" />
                ))}
              </div>
              <Skeleton className="h-10 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
