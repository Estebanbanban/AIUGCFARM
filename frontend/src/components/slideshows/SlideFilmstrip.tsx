"use client";

import { useRef, useCallback } from "react";
import { Plus, ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSlideshowEditorStore } from "@/stores/slideshow-editor";
import {
  useCollectionImages,
  useUploadCollectionImages,
} from "@/hooks/use-collections";

export function SlideFilmstrip() {
  const store = useSlideshowEditorStore();
  const { data: collectionData, isLoading } = useCollectionImages(
    store.selectedCollectionId,
  );
  const uploadImages = useUploadCollectionImages();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const images = collectionData?.images ?? [];
  const selectedSlide = store.slides[store.selectedSlideIndex];

  const handleImageClick = (imageId: string, imageUrl: string) => {
    if (store.selectedSlideIndex >= 0) {
      store.updateSlideImage(store.selectedSlideIndex, imageId, imageUrl);
    }
  };

  const handleUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length || !store.selectedCollectionId) return;
      uploadImages.mutate({
        collectionId: store.selectedCollectionId,
        files: Array.from(files),
      });
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [store.selectedCollectionId, uploadImages],
  );

  if (!store.selectedCollectionId) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center">
        <ImageIcon className="mx-auto size-6 text-muted-foreground/40 mb-2" />
        <p className="text-xs text-muted-foreground">
          Select a collection to browse images
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">
          Collection Images
        </label>
        <span className="text-xs text-muted-foreground">
          {images.length} image{images.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {isLoading && (
          <div className="flex items-center justify-center h-[64px] w-full">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading &&
          images.map((image) => {
            const isAssigned = selectedSlide?.imageId === image.id;
            return (
              <button
                key={image.id}
                className={cn(
                  "relative shrink-0 size-16 rounded-md overflow-hidden border-2 transition-all duration-150 hover:border-primary/60",
                  isAssigned
                    ? "border-primary ring-1 ring-primary/30"
                    : "border-border",
                )}
                onClick={() => handleImageClick(image.id, image.url ?? "")}
                title={image.filename}
              >
                {image.url ? (
                  <img
                    src={image.url}
                    alt={image.filename}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    <ImageIcon className="size-4 text-muted-foreground/40" />
                  </div>
                )}
              </button>
            );
          })}

        {/* Add more images button */}
        <Button
          variant="outline"
          className="shrink-0 size-16 rounded-md p-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadImages.isPending}
        >
          {uploadImages.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-5" />
          )}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>
    </div>
  );
}
