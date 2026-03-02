import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      {/* Billing link card */}
      <Card>
        <CardContent className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-1 h-3 w-60" />
            </div>
          </div>
          <Skeleton className="h-8 w-32 rounded-md" />
        </CardContent>
      </Card>

      <Separator />

      {/* Profile card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div>
              <Skeleton className="h-5 w-20" />
              <Skeleton className="mt-1 h-3 w-44" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <Skeleton className="h-9 w-28 rounded-md" />
        </CardContent>
      </Card>

      <Separator />

      {/* Danger zone card */}
      <Card className="border-red-500/20">
        <CardHeader>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-1 h-3 w-52" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-1 h-3 w-72" />
            </div>
            <Skeleton className="h-8 w-36 rounded-md" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
