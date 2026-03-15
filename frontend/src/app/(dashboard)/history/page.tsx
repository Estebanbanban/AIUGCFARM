"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGenerationWizardStore } from "@/stores/generation-wizard";
import {
  Clock,
  Video,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertCircle,
  RefreshCw,
  FileText,
  Trash2,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useGenerationHistory, useDeleteGeneration } from "@/hooks/use-generations";
import { isExternalUrl, getSignedImageUrl } from "@/lib/storage";
import type { GenerationStatus } from "@/types/database";
/**
 * Thumbnail for a history card.
 * Prefers the composite scene image (POV shot), falls back to product image.
 * Handles both full signed URLs (external) and Supabase storage paths.
 */
function HistoryThumbnail({
  compositeUrl,
  productPath,
  alt,
}: {
  compositeUrl: string | null;
  productPath?: string;
  alt: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      // 1. Try composite scene image first
      if (!useFallback && compositeUrl) {
        const url = isExternalUrl(compositeUrl)
          ? compositeUrl
          : await getSignedImageUrl("composite-images", compositeUrl);
        if (!cancelled && url && url !== "/placeholder-product.svg") {
          setSrc(url);
          return;
        }
      }
      // 2. Fall back to product image
      if (productPath) {
        const url = isExternalUrl(productPath)
          ? productPath
          : await getSignedImageUrl("product-images", productPath);
        if (!cancelled) setSrc(url);
      }
    }
    resolve();
    return () => { cancelled = true; };
  }, [compositeUrl, productPath, useFallback]);

  if (!src) return <User className="size-5 text-muted-foreground" />;
  return (
    <img
      src={src}
      alt={alt}
      className="size-full rounded-lg object-cover"
      loading="lazy"
      decoding="async"
      onError={() => { if (!useFallback) setUseFallback(true); }}
    />
  );
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
    case "awaiting_approval":
      return "Review Script";
    default:
      return "In Progress";
  }
}

type HistoryStatusFilter = "all" | "in_progress" | "review_script" | "completed" | "failed";

function toStatusFilter(status: GenerationStatus): Exclude<HistoryStatusFilter, "all"> {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "awaiting_approval") return "review_script";
  return "in_progress";
}

/* -------------------------------------------------------------------------- */
/*  Error message sanitizer                                                   */
/* -------------------------------------------------------------------------- */

function sanitizeErrorMessage(raw: string | null | undefined): string {
  if (!raw) return "Generation failed. Please try again.";

  // TDZ / JavaScript initialization errors
  if (raw.includes("before initialization") || raw.includes("TDZ")) {
    return "Video generation failed due to a processing error. Please try again.";
  }
  // All jobs failed / AI service overloaded
  if (raw.includes("All video job submissions failed") || raw.includes("temporarily overloaded")) {
    return "AI video service is temporarily busy. Please try again in a moment.";
  }
  // Insufficient credits - already user-friendly, keep as-is
  if (raw.includes("Insufficient credits") || raw.includes("credits")) {
    return raw;
  }
  // Script/composite image errors
  if (raw.includes("composite image") || raw.includes("signed URL")) {
    return "Failed to prepare the scene image. Please try again.";
  }
  // Strip bare "Error:" prefix
  if (raw.startsWith("Error: ")) {
    return raw.slice(7);
  }
  // Anything too long or too technical
  if (raw.length > 120) {
    return "Video generation failed. Our team has been notified. Please try again.";
  }
  return raw;
}

/* -------------------------------------------------------------------------- */
/*  Main page                                                                 */
/* -------------------------------------------------------------------------- */

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("all");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const { data, isLoading, error } = useGenerationHistory(page);
  const deleteGeneration = useDeleteGeneration();
  const router = useRouter();
  const wizard = useGenerationWizardStore();

  function handleTryAgain(gen: { product_id: string; persona_id: string; mode: string; video_quality?: string | null }) {
    wizard.reset();
    if (gen.product_id) wizard.setProductId(gen.product_id);
    if (gen.persona_id) wizard.setPersonaId(gen.persona_id);
    if (gen.mode) wizard.setMode(gen.mode as "single" | "triple");
    if (gen.video_quality) wizard.setQuality(gen.video_quality as "standard" | "hd");
    wizard.setStep(2);
    router.push("/generate");
  }

  function handleResumeScript(gen: { id: string; product_id: string; persona_id: string; mode: string; video_quality?: string | null }) {
    wizard.setProductId(gen.product_id);
    wizard.setPersonaId(gen.persona_id);
    wizard.setMode(gen.mode as "single" | "triple");
    if (gen.video_quality) wizard.setQuality(gen.video_quality as "standard" | "hd");
    // Set pendingGenerationId so the generate page's mount validation restores the script from DB
    wizard.setPendingGenerationId(gen.id);
    wizard.setStep(5);
    router.push("/generate");
  }

  const generations = data?.generations ?? [];
  const pagination = data?.pagination;
  const statusCounts = useMemo(() => {
    const counts = {
      all: generations.length,
      in_progress: 0,
      review_script: 0,
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
            {statusCounts.review_script > 0 && (
              <Button
                variant={statusFilter === "review_script" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("review_script")}
                className="border-amber-500/40 text-amber-400 hover:text-amber-300"
              >
                Review Script ({statusCounts.review_script})
              </Button>
            )}
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
              const isInProgress = ["locking", "submitting_jobs", "generating_segments"].includes(gen.status);
              return (
              <div
                key={gen.id}
                className={cn("group relative", gen.status !== "failed" && "cursor-pointer")}
                onClick={() => { if (gen.status !== "failed") router.push(`/generate/${gen.id}`); }}
              >
                <Card className={cn(
                  "h-full transition-colors hover:border-primary/30 border-l-4",
                  gen.status === "completed" && "border-emerald-500",
                  gen.status === "failed" && "border-red-500",
                  gen.status === "awaiting_approval" && "border-amber-400",
                  (gen.status === "pending" || gen.status === "generating_segments") && "border-amber-500",
                )}>
                  <CardContent className="flex flex-col gap-3 py-5">
                    {/* Scene thumbnail + names */}
                    <div className="flex items-start gap-3">
                      {/* Composite scene preview (POV shot), fallback to product image */}
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden">
                        <HistoryThumbnail
                          compositeUrl={gen.composite_image_url ?? null}
                          productPath={gen.products?.images?.[0]}
                          alt={gen.products?.name ?? "Scene preview"}
                        />
                        {!gen.composite_image_url && !gen.products?.images?.[0] && (
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
                      {/* Delete button - hidden while in-progress */}
                      {!isInProgress && (
                        <button
                          type="button"
                          className="ml-auto shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                          onClick={(e) => { e.stopPropagation(); setDeleteTargetId(gen.id); }}
                          title="Delete generation"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
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
                      {gen.status === "completed" && gen.videos && (
                        <span className="text-xs text-muted-foreground">
                          {(gen.videos.hooks?.length ?? 0) +
                            (gen.videos.bodies?.length ?? 0) +
                            (gen.videos.ctas?.length ?? 0)}{" "}
                          segments
                        </span>
                      )}
                    </div>

                    {/* Awaiting approval: prompt user to resume */}
                    {gen.status === "awaiting_approval" && (
                      <div
                        className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2"
                        onClick={(e) => e.preventDefault()}
                      >
                        <FileText className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-amber-400">
                            Script prêt · aucun crédit débité
                          </p>
                          <button
                            type="button"
                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded transition-colors"
                            onClick={(e) => { e.stopPropagation(); handleResumeScript(gen); }}
                          >
                            <FileText className="size-3" />
                            Reprendre et approuver
                          </button>
                        </div>
                      </div>
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
                            {sanitizeErrorMessage(gen.error_message)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Credits returned to your account.</p>
                          <button
                            type="button"
                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary border border-primary/40 bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded transition-colors"
                            onClick={(e) => { e.stopPropagation(); handleTryAgain(gen); }}
                          >
                            <RefreshCw className="size-3" />
                            Try Again
                          </button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              );
            })}
          </div>

          {/* Delete confirmation dialog */}
          <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this generation?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove the generation from your history. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteGeneration.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                  disabled={deleteGeneration.isPending}
                  onClick={() => {
                    if (!deleteTargetId) return;
                    deleteGeneration.mutate(deleteTargetId, {
                      onSuccess: () => setDeleteTargetId(null),
                    });
                  }}
                >
                  {deleteGeneration.isPending ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

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
