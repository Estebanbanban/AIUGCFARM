"use client";

import { Play, Send, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Slideshow } from "@/types/slideshow";

interface ExportedSlideshowCardProps {
  slideshow: Slideshow;
  onClick: () => void;
}

export function ExportedSlideshowCard({ slideshow, onClick }: ExportedSlideshowCardProps) {
  const firstSlide = slideshow.slides?.[0];
  const thumbnailUrl = slideshow.thumbnail_url ?? firstSlide?.imageUrl;
  const hookText = firstSlide?.text || slideshow.hook_text || slideshow.name;
  const exportedDate = slideshow.exported_at
    ? new Date(slideshow.exported_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="group flex flex-col gap-2">
      {/* 9:16 thumbnail card */}
      <Card
        className="relative cursor-pointer overflow-hidden transition-all hover:border-primary/30 hover:shadow-lg p-0"
        onClick={onClick}
      >
        <div className="relative w-full" style={{ aspectRatio: "9 / 16" }}>
          {/* Background image */}
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={slideshow.name}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
              <ImageIcon className="size-10 text-muted-foreground/30" />
            </div>
          )}

          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />

          {/* Hook text overlaid */}
          {hookText && (
            <div className="absolute inset-0 flex items-start justify-center px-[8%] pt-[15%]">
              <p
                className="text-center text-xs font-bold leading-tight text-white lowercase line-clamp-4"
                style={{ textShadow: "0 2px 8px rgba(0,0,0,0.7)" }}
              >
                {hookText}
              </p>
            </div>
          )}

          {/* Play button centered */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-white/80 shadow-lg backdrop-blur-sm transition-transform group-hover:scale-110">
              <Play className="size-5 text-black ml-0.5" fill="currentColor" />
            </div>
          </div>

          {/* Exported date badge */}
          {exportedDate && (
            <div className="absolute bottom-2 left-2">
              <span className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
                Exported {exportedDate}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Info below card */}
      <div className="flex flex-col gap-1 px-1">
        <p className="truncate text-sm font-medium text-foreground">
          {slideshow.name || "Untitled Slideshow"}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{slideshow.slides?.length ?? 0} slides</span>
        </div>
      </div>

      {/* Quick publish button */}
      <div className="px-1">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          disabled
          title="TikTok publishing coming soon"
        >
          <Send className="size-3" />
          Quick publish
        </Button>
      </div>
    </div>
  );
}
