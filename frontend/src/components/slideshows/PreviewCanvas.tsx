"use client";

import { useState } from "react";
import {
  Maximize2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSlideshowEditorStore } from "@/stores/slideshow-editor";
import { useCollectionImages } from "@/hooks/use-collections";
import { SlidePreview } from "./SlidePreview";
import { SlideFilmstrip } from "./SlideFilmstrip";
import { SlideFullscreenModal } from "./SlideFullscreenModal";

export function PreviewCanvas() {
  const store = useSlideshowEditorStore();
  const [showFullscreen, setShowFullscreen] = useState(false);
  const { data: collectionData } = useCollectionImages(store.selectedCollectionId);

  const handleAddSlide = () => {
    store.addSlide("body");

    // Read fresh state AFTER addSlide mutated the store (avoids stale closure)
    const freshState = useSlideshowEditorStore.getState();
    const newIdx = freshState.selectedSlideIndex;

    // Auto-assign a random image from the collection to the new slide
    const images = collectionData?.images ?? [];
    if (images.length === 0) return;

    // Find images not already used by other slides
    const usedImageIds = new Set(freshState.slides.map((s) => s.imageId).filter(Boolean));
    const available = images.filter((img) => !usedImageIds.has(img.id) && img.url);
    const pick = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : images[Math.floor(Math.random() * images.length)];

    if (pick?.url) {
      store.updateSlideImage(newIdx, pick.id, pick.url);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* All slides in a horizontal row — click to select */}
      <div className="flex-1 flex items-center justify-center gap-2 p-4 overflow-x-auto min-h-0">
        {store.slides.length > 0 ? (
          store.slides.map((slide, index) => {
            const slideScale =
              store.slides.length <= 3 ? 0.65 :
              store.slides.length <= 5 ? 0.5 :
              0.4;

            return (
              <div key={slide.id} className="flex flex-col items-center gap-1 shrink-0">
                <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
                  {slide.type === "hook"
                    ? "Hook"
                    : slide.type === "cta"
                      ? "CTA"
                      : `${index + 1}`}
                </span>
                <div className="group relative">
                  <SlidePreview
                    slide={slide}
                    settings={store.settings}
                    isSelected={store.selectedSlideIndex === index}
                    scale={slideScale}
                    onClick={() => store.selectSlide(index)}
                    captionStyle={store.settings.captionStyle}
                    showPill={store.settings.showPill}
                  />
                  {/* Magnify button overlay */}
                  <button
                    type="button"
                    className="absolute top-2 right-2 z-10 flex size-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/70"
                    onClick={(e) => {
                      e.stopPropagation();
                      store.selectSlide(index);
                      setShowFullscreen(true);
                    }}
                  >
                    <Maximize2 className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              No slides yet.
            </p>
            <Button variant="outline" size="sm" onClick={() => store.addSlide("hook")}>
              <Plus className="size-3.5" />
              Add Hook Slide
            </Button>
          </div>
        )}
      </div>

      {/* Bottom bar — filmstrip + controls */}
      {store.slides.length > 0 && (
        <div className="border-t border-border bg-card/50 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleAddSlide}
              >
                <Plus className="size-3" />
                Add Slide
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => store.removeSlide(store.selectedSlideIndex)}
              disabled={store.slides.length <= 1}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>

          {/* Image filmstrip */}
          <SlideFilmstrip />
        </div>
      )}
      <SlideFullscreenModal open={showFullscreen} onOpenChange={setShowFullscreen} />
    </div>
  );
}
