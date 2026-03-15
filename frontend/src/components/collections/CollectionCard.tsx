"use client";

import { Trash2, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ImageCollection } from "@/types/slideshow";

interface CollectionCardProps {
  collection: ImageCollection;
  onClick: () => void;
  onDelete: () => void;
}

export function CollectionCard({ collection, onClick, onDelete }: CollectionCardProps) {
  const previews = collection.preview_images ?? [];
  const hasImages = previews.length > 0;

  return (
    <button type="button" onClick={onClick} className="group w-full text-left">
      <Card className="h-full transition-colors hover:border-primary/30">
        <CardContent className="flex flex-col gap-3 p-4">
          {/* 2x2 image mosaic or gradient placeholder */}
          <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
            {hasImages ? (
              <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5">
                {Array.from({ length: 4 }).map((_, i) => {
                  const src = previews[i];
                  return src ? (
                    <img
                      key={i}
                      src={src}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      key={i}
                      className="h-full w-full bg-muted"
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
                <Images className="size-10 text-muted-foreground/40" />
              </div>
            )}

            {/* Delete button */}
            <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="destructive"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>

          {/* Info */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{collection.name}</p>
              <p className="text-xs text-muted-foreground">
                {collection.image_count} image{collection.image_count !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
