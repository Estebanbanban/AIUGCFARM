"use client";

import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSlideshowEditorStore } from "@/stores/slideshow-editor";
import { SlidePreview } from "./SlidePreview";

interface SlideFullscreenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SlideFullscreenModal({ open, onOpenChange }: SlideFullscreenModalProps) {
  const store = useSlideshowEditorStore();
  const slide = store.slides[store.selectedSlideIndex];

  const isFirst = store.selectedSlideIndex === 0;
  const isLast = store.selectedSlideIndex === store.slides.length - 1;

  function handlePrev() {
    if (!isFirst) store.selectSlide(store.selectedSlideIndex - 1);
  }

  function handleNext() {
    if (!isLast) store.selectSlide(store.selectedSlideIndex + 1);
  }

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      // Don't navigate when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "Escape") onOpenChange(false);
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, store.selectedSlideIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !slide) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-10 text-white hover:bg-white/10"
        onClick={() => onOpenChange(false)}
      >
        <X className="size-5" />
      </Button>

      {/* Slide counter + type label */}
      <div className="absolute top-4 left-4 z-10">
        <span className="text-sm font-medium text-white/70">
          {store.selectedSlideIndex + 1} / {store.slides.length}
          <span className="ml-2 uppercase text-xs text-white/50">
            {slide.type}
          </span>
        </span>
      </div>

      {/* Previous button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-4 z-10 text-white hover:bg-white/10 disabled:opacity-20"
        disabled={isFirst}
        onClick={handlePrev}
      >
        <ChevronLeft className="size-8" />
      </Button>

      {/* Slide preview + inline editing */}
      <div className="flex flex-col items-center gap-4 max-h-[90vh]">
        <SlidePreview
          slide={slide}
          settings={store.settings}
          scale={1.8}
          captionStyle={store.settings.captionStyle}
          showPill={store.settings.showPill}
        />

        {/* Inline text editing below the slide */}
        <div className="w-full max-w-md space-y-2">
          {slide.type === "hook" ? (
            <Textarea
              value={slide.text}
              onChange={(e) => store.updateSlideText(store.selectedSlideIndex, e.target.value)}
              placeholder="Hook text..."
              className="bg-white/10 border-white/20 text-white placeholder:text-white/30 text-sm resize-none"
              rows={2}
            />
          ) : (
            <>
              <Input
                value={slide.textContent?.title ?? ""}
                onChange={(e) => store.updateSlideTextContent(store.selectedSlideIndex, { title: e.target.value })}
                placeholder="Title (white pill)"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30 text-sm"
              />
              <Input
                value={slide.textContent?.subtitle ?? ""}
                onChange={(e) => store.updateSlideTextContent(store.selectedSlideIndex, { subtitle: e.target.value })}
                placeholder="Context / subtitle"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30 text-sm"
              />
              <Input
                value={slide.textContent?.action ?? ""}
                onChange={(e) => store.updateSlideTextContent(store.selectedSlideIndex, { action: e.target.value })}
                placeholder="Action / CTA"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30 text-sm"
              />
            </>
          )}
        </div>
      </div>

      {/* Next button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 z-10 text-white hover:bg-white/10 disabled:opacity-20"
        disabled={isLast}
        onClick={handleNext}
      >
        <ChevronRight className="size-8" />
      </Button>
    </div>
  );
}
