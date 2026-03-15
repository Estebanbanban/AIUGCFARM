"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSlideshows, useCreateSlideshow } from "@/hooks/use-slideshows";
import { ExportedSlideshowCard } from "./ExportedSlideshowCard";
import { SlideshowCard } from "./SlideshowCard";
import type { Slide } from "@/types/slideshow";

export function SlideshowGallery({ currentSlideshowId }: { currentSlideshowId?: string }) {
  const router = useRouter();
  const { data } = useSlideshows();
  const slideshows = data?.slideshows ?? [];
  const createSlideshow = useCreateSlideshow();

  const allSlideshows = useMemo(
    () =>
      [...slideshows].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    [slideshows],
  );

  const handleNewSlideshow = () => {
    const defaultSlides: Slide[] = [
      { id: crypto.randomUUID(), type: "hook", order: 0, imageId: null, imageUrl: null, text: "" },
      { id: crypto.randomUUID(), type: "body", order: 1, imageId: null, imageUrl: null, text: "" },
      { id: crypto.randomUUID(), type: "body", order: 2, imageId: null, imageUrl: null, text: "" },
      { id: crypto.randomUUID(), type: "body", order: 3, imageId: null, imageUrl: null, text: "" },
      { id: crypto.randomUUID(), type: "cta", order: 4, imageId: null, imageUrl: null, text: "" },
    ];
    createSlideshow.mutate(
      { name: "Untitled Slideshow", slides: defaultSlides },
      {
        onSuccess: (slideshow) => router.push(`/slideshows/${slideshow.id}`),
      },
    );
  };

  return (
    <div className="border-t border-border bg-card/30 px-6 py-5 space-y-4">
      {/* Title + New button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">My Slideshows ({allSlideshows.length})</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNewSlideshow}
          disabled={createSlideshow.isPending}
        >
          <Plus className="size-3.5" />
          New Slideshow
        </Button>
      </div>

      {/* Unified grid */}
      {allSlideshows.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {allSlideshows.map((slideshow) =>
            slideshow.exported_at ? (
              <ExportedSlideshowCard
                key={slideshow.id}
                slideshow={slideshow}
                onClick={() => {
                  if (slideshow.id !== currentSlideshowId) {
                    router.push(`/slideshows/${slideshow.id}`);
                  }
                }}
              />
            ) : (
              <SlideshowCard
                key={slideshow.id}
                slideshow={slideshow}
                onEdit={() => {
                  if (slideshow.id !== currentSlideshowId) {
                    router.push(`/slideshows/${slideshow.id}`);
                  }
                }}
                onDelete={() => {}}
              />
            )
          )}

          {/* Plus button to create new */}
          <button
            className="rounded-lg border-2 border-dashed border-border/40 hover:border-primary/40 transition-colors flex items-center justify-center"
            style={{ aspectRatio: "9 / 16" }}
            onClick={handleNewSlideshow}
          >
            <Plus className="size-8 text-muted-foreground/40" />
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No slideshows yet. Click + to create one.
          </p>
        </div>
      )}
    </div>
  );
}
