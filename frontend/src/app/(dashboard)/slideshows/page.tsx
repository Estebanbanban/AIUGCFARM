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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const [activeTab, setActiveTab] = useState<"exported" | "drafts">("exported");
  const [page, setPage] = useState(1);
  const [slideshowToDelete, setSlideshowToDelete] = useState<Slideshow | null>(null);

  const slideshows = slideshowsData?.slideshows ?? [];

  // Separate exported from drafts
  // Exported = has exported_at timestamp (regardless of status)
  // Drafts = everything without exported_at
  const exported = slideshows
    .filter((s) => s.exported_at)
    .sort((a, b) => new Date(b.exported_at!).getTime() - new Date(a.exported_at!).getTime());
  const drafts = slideshows
    .filter((s) => !s.exported_at)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const exportedCount = exported.length;
  const draftCount = drafts.length;

  // Separate pagination per tab
  const activeList = activeTab === "exported" ? exported : drafts;
  const totalPages = Math.max(1, Math.ceil(activeList.length / ITEMS_PER_PAGE));
  const exportedPaged = exported.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const draftsPaged = drafts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

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

  function handleTabChange(value: string) {
    setActiveTab(value as "exported" | "drafts");
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Slideshows</h1>
          <span className="mt-1 block text-sm text-muted-foreground" suppressHydrationWarning>
            {isLoading ? (
              <Skeleton className="inline-block h-4 w-32" />
            ) : (
              `${slideshows.length} slideshow${slideshows.length !== 1 ? "s" : ""}`
            )}
          </span>
        </div>
        <Button onClick={() => router.push("/slideshows/new")}>
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
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SlideshowCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Main content */}
      {!isLoading && !error && hasSlideshows && (
        <>
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="exported">
                Exported Slideshows ({exportedCount})
              </TabsTrigger>
              <TabsTrigger value="drafts">
                Drafts ({draftCount})
              </TabsTrigger>
            </TabsList>

            {/* Exported tab */}
            <TabsContent value="exported" forceMount className={activeTab !== "exported" ? "hidden" : ""}>
              {exportedPaged.length > 0 ? (
                <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {exportedPaged.map((slideshow) => (
                    <ExportedSlideshowCard
                      key={slideshow.id}
                      slideshow={slideshow}
                      onClick={() => router.push(`/slideshows/${slideshow.id}`)}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center gap-4 py-12">
                    <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                      <Film className="size-7 text-primary" />
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold">No exported slideshows yet</h3>
                      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        Open a slideshow and click &quot;Export ZIP&quot; to see it here.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Drafts tab */}
            <TabsContent value="drafts" forceMount className={activeTab !== "drafts" ? "hidden" : ""}>
              {draftsPaged.length > 0 ? (
                <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {draftsPaged.map((slideshow) => (
                    <SlideshowCard
                      key={slideshow.id}
                      slideshow={slideshow}
                      onEdit={() => router.push(`/slideshows/${slideshow.id}`)}
                      onDelete={() => setSlideshowToDelete(slideshow)}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center gap-3 py-8">
                    <p className="text-sm text-muted-foreground">
                      No draft slideshows found.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

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
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
              <Film className="size-7 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">No slideshows yet</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Create your first TikTok slideshow with images, text overlays, and music.
              </p>
            </div>
            <Button onClick={() => router.push("/slideshows/new")}>
              <Plus className="size-4" />
              New Slideshow
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
  );
}
