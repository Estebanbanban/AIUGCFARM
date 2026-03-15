"use client";

import { Play, Pencil, Download, Trash2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Slideshow } from "@/types/slideshow";

interface SlideshowCardProps {
  slideshow: Slideshow;
  onEdit: () => void;
  onDelete: () => void;
}

const statusConfig: Record<
  Slideshow["status"],
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-muted text-muted-foreground border-border",
  },
  rendering: {
    label: "Rendering",
    className: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20 animate-pulse",
  },
  complete: {
    label: "Complete",
    className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  },
};

export function SlideshowCard({ slideshow, onEdit, onDelete }: SlideshowCardProps) {
  const firstSlide = slideshow.slides?.[0];
  const thumbnailUrl = slideshow.thumbnail_url ?? firstSlide?.imageUrl;
  const status = statusConfig[slideshow.status];
  const slideCount = slideshow.slides?.length ?? 0;
  const updatedDate = new Date(slideshow.updated_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="group flex flex-col gap-2">
      {/* 9:16 thumbnail */}
      <Card
        className="relative cursor-pointer overflow-hidden transition-colors hover:border-primary/30 p-0"
        onClick={onEdit}
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

          {/* Dark overlay */}
          {thumbnailUrl && (
            <div className="absolute inset-0 bg-black/20" />
          )}

          {/* Hook text preview */}
          {firstSlide?.text && thumbnailUrl && (
            <div className="absolute inset-0 flex items-start justify-center px-[8%] pt-[15%]">
              <p
                className="text-center text-xs font-bold leading-tight text-white lowercase line-clamp-3"
                style={{ textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}
              >
                {firstSlide.text}
              </p>
            </div>
          )}

          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex size-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
              <Play className="size-5 text-black" fill="currentColor" />
            </div>
          </div>

          {/* Status badge */}
          <div className="absolute right-2 top-2">
            <Badge variant="outline" className={cn("text-[10px]", status.className)}>
              {status.label}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Info below card */}
      <div className="flex flex-col gap-0.5 px-1">
        <p className="truncate text-sm font-medium text-foreground">
          {slideshow.name || "Untitled Slideshow"}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{slideCount} slide{slideCount !== 1 ? "s" : ""}</span>
          <span>&middot;</span>
          <span>{updatedDate}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 px-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="icon-xs" onClick={onEdit}>
          <Pencil className="size-3" />
        </Button>
        {slideshow.status === "complete" && slideshow.video_storage_path && (
          <Button variant="ghost" size="icon-xs">
            <Download className="size-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );
}
