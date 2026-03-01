import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Welcome card */}
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-3 h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-96" />
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="size-4" />
              </div>
              <Skeleton className="mt-3 h-9 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex h-full flex-col gap-3 rounded-lg border p-4">
              <Skeleton className="size-10 rounded-xl" />
              <div>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-1 h-3 w-40" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
