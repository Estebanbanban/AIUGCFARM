"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  Film,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useSlideshows, useDeleteSlideshow } from "@/hooks/use-slideshows";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SlideshowCard } from "@/components/slideshows/SlideshowCard";
import { ExportedSlideshowCard } from "@/components/slideshows/ExportedSlideshowCard";
import type { Slideshow } from "@/types/slideshow";

const ITEMS_PER_PAGE = 12;

function SlideshowCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="w-full rounded-xl" style={{ aspectRatio: "9 / 16" }} />
      <div className="flex flex-col gap-1.5 px-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export default function SlideshowsPage() {
  const router = useRouter();
  const { data: slideshowsData, isLoading, error } = useSlideshows();
  const deleteSlideshow = useDeleteSlideshow();

  const [page, setPage] = useState(1);
  const [slideshowToDelete, setSlideshowToDelete] = useState<Slideshow | null>(null);

  const slideshows = slideshowsData?.slideshows ?? [];

  const allSorted = [...slideshows].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  const totalPages = Math.max(1, Math.ceil(allSorted.length / ITEMS_PER_PAGE));
  const paged = allSorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const hasSlideshows = slideshows.length > 0;

  async function handleDelete() {
    if (!slideshowToDelete) return;
    try {
      await deleteSlideshow.mutateAsync(slideshowToDelete.id);
      toast.success(`"${slideshowToDelete.name || "Untitled"}" deleted`);
      setSlideshowToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete slideshow");
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Slideshows</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading
                ? "Loading..."
                : `${slideshows.length} slideshow${slideshows.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Button onClick={() => router.push("/slideshows/new")} size="sm">
            <Plus className="size-4" />
            New Slideshow
          </Button>
        </div>

        {/* Error state */}
        {error && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-destructive">
                Failed to load slideshows. Please try again later.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SlideshowCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Unified grid of all slideshows + inline create card */}
        {!isLoading && !error && hasSlideshows && (
          <>
            <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {paged.map((slideshow) =>
                slideshow.exported_at ? (
                  <ExportedSlideshowCard
                    key={slideshow.id}
                    slideshow={slideshow}
                    onClick={() => router.push(`/slideshows/${slideshow.id}`)}
                  />
                ) : (
                  <SlideshowCard
                    key={slideshow.id}
                    slideshow={slideshow}
                    onEdit={() => router.push(`/slideshows/${slideshow.id}`)}
                    onDelete={() => setSlideshowToDelete(slideshow)}
                  />
                )
              )}

              {/* Inline + card — same size as slideshow cards */}
              <button
                onClick={() => router.push("/slideshows/new")}
                className="group flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border/50 bg-card/30 transition-all hover:border-primary/50 hover:bg-primary/5"
                style={{ aspectRatio: "9 / 16" }}
              >
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <Plus className="size-6 text-primary" />
                </div>
                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  New Slideshow
                </span>
              </button>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!isLoading && !error && !hasSlideshows && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-5 py-16">
              <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                <Film className="size-8 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold">No slideshows yet</h3>
                <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                  Create your first TikTok slideshow with images, text overlays, and captions.
                </p>
              </div>
              <Button onClick={() => router.push("/slideshows/new")} size="lg">
                <Plus className="size-5" />
                Create Your First Slideshow
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={!!slideshowToDelete}
          onOpenChange={(open) => {
            if (!open) setSlideshowToDelete(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete slideshow</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &quot;{slideshowToDelete?.name || "Untitled"}&quot;?
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSlideshowToDelete(null)}
                disabled={deleteSlideshow.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteSlideshow.isPending}
              >
                {deleteSlideshow.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Slideshow"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
