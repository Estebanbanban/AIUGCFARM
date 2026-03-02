"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Video,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGenerationHistory } from "@/hooks/use-generations";
import { isExternalUrl, getSignedImageUrl } from "@/lib/storage";
import type { GenerationStatus } from "@/types/database";
import { calculateGenerationCost } from "@/lib/generation-cost";

/** Renders an image from either an external URL or a Supabase storage path. */
function ResolvedImage({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(isExternalUrl(path) ? path : null);
  useEffect(() => {
    if (!isExternalUrl(path)) {
      getSignedImageUrl("product-images", path).then(setSrc);
    }
  }, [path]);
  if (!src) return null;
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />;
}

/* -------------------------------------------------------------------------- */
/*  Status helpers                                                            */
/* -------------------------------------------------------------------------- */

const statusColors: Record<GenerationStatus, string> = {
  pending: "bg-zinc-500/10 text-zinc-400",
  scripting: "bg-amber-500/10 text-amber-400",
  awaiting_approval: "bg-amber-500/10 text-amber-400",
  locking: "bg-amber-500/10 text-amber-400",
  submitting_jobs: "bg-primary/10 text-primary",
  generating_segments: "bg-blue-500/10 text-blue-400",
  completed: "bg-emerald-500/10 text-emerald-400",
  failed: "bg-red-500/10 text-red-400",
};

function statusLabel(status: string): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "In Progress";
  }
}

type HistoryStatusFilter = "all" | "in_progress" | "completed" | "failed";

function toStatusFilter(status: GenerationStatus): Exclude<HistoryStatusFilter, "all"> {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "in_progress";
}

/* -------------------------------------------------------------------------- */
/*  Main page                                                                 */
/* -------------------------------------------------------------------------- */

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("all");
  const { data, isLoading, error } = useGenerationHistory(page);

  const generations = data?.generations ?? [];
  const pagination = data?.pagination;
  const statusCounts = useMemo(() => {
    const counts = {
      all: generations.length,
      in_progress: 0,
      completed: 0,
      failed: 0,
    };

    for (const generation of generations) {
      counts[toStatusFilter(generation.status)] += 1;
    }

    return counts;
  }, [generations]);

  const filteredGenerations = useMemo(() => {
    if (statusFilter === "all") return generations;
    return generations.filter((generation) => toStatusFilter(generation.status) === statusFilter);
  }, [generations, statusFilter]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Generation History
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View all your past video generations.
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="flex flex-col gap-3 py-5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-28" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <p className="text-sm text-red-400">
              {error.message || "Failed to load generation history."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && !error && generations.length === 0 && (
        <Card className="bg-gradient-to-br from-card via-card to-muted/30">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="size-7 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-foreground">
                No generations yet
              </h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Start creating AI-powered video ads for your products.
              </p>
            </div>
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link href="/generate">
                <Sparkles className="size-4" />
                Create Your First Video
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generation cards */}
      {!isLoading && generations.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
            >
              All ({statusCounts.all})
            </Button>
            <Button
              variant={statusFilter === "in_progress" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("in_progress")}
            >
              In Progress ({statusCounts.in_progress})
            </Button>
            <Button
              variant={statusFilter === "completed" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("completed")}
            >
              Completed ({statusCounts.completed})
            </Button>
            <Button
              variant={statusFilter === "failed" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("failed")}
            >
              Failed ({statusCounts.failed})
            </Button>
          </div>

          {filteredGenerations.length === 0 && (
            <Card>
              <CardContent className="py-8">
                <p className="text-sm text-muted-foreground">
                  No videos found for this status on this page.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredGenerations.map((gen) => {
              const cost = calculateGenerationCost(
                gen.videos,
                gen.video_quality,
                gen.kling_model,
              );
              const showCost = gen.status === "completed" && cost.totalBilledSeconds > 0;
              return (
              <Link
                key={gen.id}
                href={`/generate/${gen.id}`}
                className="group"
              >
                <Card className={cn(
                  "h-full transition-colors hover:border-primary/30 border-l-4",
                  gen.status === "completed" && "border-emerald-500",
                  gen.status === "failed" && "border-red-500",
                  (gen.status === "pending" || gen.status === "generating_segments") && "border-amber-500",
                )}>
                  <CardContent className="flex flex-col gap-3 py-5">
                    {/* Product & persona names */}
                    <div className="flex items-start gap-3">
                      {/* Product image thumbnail */}
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        {gen.products?.images?.[0] ? (
                          <ResolvedImage
                            path={gen.products.images[0]}
                            alt={gen.products?.name ?? "Product"}
                            className="size-full rounded-lg object-cover"
                          />
                        ) : (
                          <Video className="size-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {gen.products?.name ?? `Product ${gen.product_id.slice(0, 8)}...`}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {gen.personas?.name ?? `Persona ${gen.persona_id.slice(0, 8)}...`}
                        </p>
                      </div>
                    </div>

                    {/* Status & date */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {formatDate(gen.created_at)}
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs capitalize",
                          statusColors[gen.status] ?? statusColors.pending
                        )}
                      >
                        {statusLabel(gen.status)}
                      </Badge>
                    </div>

                    {/* Mode + segment count */}
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {gen.mode} mode
                      </Badge>
                      {showCost && (
                        <Badge variant="outline" className="text-xs">
                          {cost.modelName}
                        </Badge>
                      )}
                      {gen.status === "completed" && gen.videos && (
                        <span className="text-xs text-muted-foreground">
                          {(gen.videos.hooks?.length ?? 0) +
                            (gen.videos.bodies?.length ?? 0) +
                            (gen.videos.ctas?.length ?? 0)}{" "}
                          segments
                        </span>
                      )}
                    </div>

                    {showCost && (
                      <p className="text-xs text-muted-foreground">
                        Cost:{" "}
                        <span className="font-medium text-foreground">
                          {formatCurrency(cost.totalCostUsd)}
                        </span>{" "}
                        ({cost.totalBilledSeconds}s billed)
                      </p>
                    )}

                    {/* Failed: show error + retry */}
                    {gen.status === "failed" && (
                      <div
                        className="flex items-start gap-2 rounded-md bg-red-500/10 px-3 py-2"
                        onClick={(e) => e.preventDefault()}
                      >
                        <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-red-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-red-400">
                            {gen.error_message ?? "Generation failed"}
                          </p>
                          <Link
                            href="/generate"
                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 px-2 py-1 rounded transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <RefreshCw className="size-3" />
                            Try again
                          </Link>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.has_prev}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.has_next}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
