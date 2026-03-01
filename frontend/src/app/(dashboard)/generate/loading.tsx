import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="hidden h-4 w-20 sm:block" />
            {i < 3 && <Skeleton className="h-px w-8" />}
          </div>
        ))}
      </div>

      {/* Product selection grid */}
      <Card>
        <CardContent className="p-6">
          <Skeleton className="mb-4 h-5 w-32" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 rounded-lg border p-3">
                <Skeleton className="size-16 shrink-0 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-2 h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
