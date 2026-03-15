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

  return (
    <div className="flex h-full flex-col gap-4 p-5">
      {/* Preview area — all slides in a scrollable row */}
      <div className="flex-1 flex items-start justify-center gap-3 overflow-x-auto overflow-y-hidden py-2">
        {store.slides.length > 0 ? (
          store.slides.map((slide, index) => (
            <div key={slide.id} className="flex flex-col items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {slide.type === "hook"
                  ? "Hook"
                  : slide.type === "cta"
                    ? "CTA"
                    : `Slide ${index + 1}`}
              </span>
              <SlidePreview
                slide={slide}
                settings={store.settings}
                isSelected={store.selectedSlideIndex === index}
                scale={store.slides.length <= 3 ? 0.75 : store.slides.length <= 5 ? 0.55 : 0.45}
                onClick={() => store.selectSlide(index)}
                captionStyle={store.settings.captionStyle}
                showPill={store.settings.showPill}
              />
            </div>
          ))
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

      {/* Slide thumbnails strip */}
      {store.slides.length > 0 && (
        <div className="space-y-3">
          {/* Bottom controls */}
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
                {/* Mini thumbnail */}
                {slide.imageUrl ? (
                  <img
                    src={slide.imageUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="absolute inset-0 bg-muted" />
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
                {/* Mini label */}
                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] text-center py-0.5 font-medium">
                  {slide.type === "hook"
                    ? "H"
                    : slide.type === "cta"
                      ? "CTA"
                      : index}
                </div>
              </button>
            ))}

            {/* Add slide button */}
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
