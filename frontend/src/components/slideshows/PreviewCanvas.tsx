"use client";

import {
  Plus,
  Trash2,
  Clock,
  RectangleHorizontal,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSlideshowEditorStore } from "@/stores/slideshow-editor";
import { SlidePreview } from "./SlidePreview";
import { SlideFilmstrip } from "./SlideFilmstrip";

export function PreviewCanvas() {
  const store = useSlideshowEditorStore();
  const selectedSlide = store.slides[store.selectedSlideIndex];

  return (
    <div className="flex h-full flex-col">
      {/* Main preview — selected slide large */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-0">
        {selectedSlide ? (
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {selectedSlide.type === "hook"
                ? "Hook"
                : selectedSlide.type === "cta"
                  ? "CTA"
                  : `Slide ${store.selectedSlideIndex + 1}`}
            </span>
            <SlidePreview
              slide={selectedSlide}
              settings={store.settings}
              isSelected
              scale={0.7}
              captionStyle={store.settings.captionStyle}
              showPill={store.settings.showPill}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-2xl border-2 border-dashed border-border p-8 mb-4">
              <RectangleHorizontal className="size-12 text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              No slides yet. Add a hook and body slides to get started.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => store.addSlide("hook")}
            >
              <Plus className="size-3.5" />
              Add Hook Slide
            </Button>
          </div>
        )}
      </div>

      {/* Bottom section — controls + filmstrip */}
      {store.slides.length > 0 && (
        <div className="border-t border-border bg-card/50 px-4 py-3 space-y-3">
          {/* Controls row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="gap-1 text-xs">
                <Palette className="size-3" />
                Overlay
              </Badge>
              <Badge variant="outline" className="gap-1 text-xs">
                <Clock className="size-3" />
                {store.settings.slideDuration}s
              </Badge>
              <Badge variant="outline" className="gap-1 text-xs">
                <RectangleHorizontal className="size-3" />
                {store.settings.aspectRatio}
              </Badge>
            </div>

            <div className="flex items-center gap-1">
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
          </div>

          {/* Slide thumbnail strip */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {store.slides.map((slide, index) => (
              <button
                key={slide.id}
                className={cn(
                  "relative shrink-0 rounded-md overflow-hidden border-2 transition-all duration-150",
                  index === store.selectedSlideIndex
                    ? "border-primary ring-1 ring-primary/20"
                    : "border-border hover:border-primary/40",
                )}
                style={{ width: "54px", aspectRatio: "9 / 16" }}
                onClick={() => store.selectSlide(index)}
              >
                {slide.imageUrl ? (
                  <img
                    src={slide.imageUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-b from-neutral-600 to-neutral-800" />
                )}
                {store.settings.overlay.enabled && (
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundColor: store.settings.overlay.color,
                      opacity: slide.overlayOpacity ?? store.settings.overlay.opacity,
                    }}
                  />
                )}
                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] text-center py-0.5 font-medium">
                  {slide.type === "hook"
                    ? "H"
                    : slide.type === "cta"
                      ? "CTA"
                      : index}
                </div>
              </button>
            ))}

            <button
              className="shrink-0 flex items-center justify-center rounded-md border-2 border-dashed border-border hover:border-primary/40 transition-colors"
              style={{ width: "54px", aspectRatio: "9 / 16" }}
              onClick={() => store.addSlide("body")}
            >
              <Plus className="size-4 text-muted-foreground" />
            </button>
          </div>

          {/* Image filmstrip from collection */}
          <SlideFilmstrip />
        </div>
      )}
    </div>
  );
}
