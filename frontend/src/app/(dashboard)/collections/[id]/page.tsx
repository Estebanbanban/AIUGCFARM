"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  Trash2,
  Loader2,
  Check,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageUploadZone } from "@/components/collections/ImageUploadZone";
import {
  useCollections,
  useCollectionImages,
  useUploadCollectionImages,
  useDeleteCollectionImage,
} from "@/hooks/use-collections";
import { cn } from "@/lib/utils";
import type { CollectionImage } from "@/types/slideshow";

function ImageSkeleton() {
  return <Skeleton className="aspect-square rounded-lg" />;
}

export default function CollectionDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: collections } = useCollections();
  const collection = collections?.find((c) => c.id === id);
  const { data: imagesData, isLoading: imagesLoading } = useCollectionImages(id);
  const deleteImage = useDeleteCollectionImage();
  const uploadImages = useUploadCollectionImages();

  const images = imagesData?.images ?? [];
  const hasImages = images.length > 0;

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isSelecting = selectedIds.size > 0;

  // Image to delete (single delete confirmation)
  const [imageToDelete, setImageToDelete] = useState<CollectionImage | null>(null);

  // Bulk delete confirmation
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  // File input ref for the header upload button
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleSelect(imageId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  }

  function handleHeaderUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      uploadImages.mutate(
        { collectionId: id, files },
        {
          onSuccess: (data) => {
            toast.success(`${data.uploaded} image${data.uploaded !== 1 ? "s" : ""} uploaded`);
          },
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to upload images");
          },
        }
      );
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDeleteSingle() {
    if (!imageToDelete) return;
    try {
      await deleteImage.mutateAsync({
        id: imageToDelete.id,
        collectionId: id,
      });
      toast.success("Image deleted");
      setImageToDelete(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(imageToDelete.id);
        return next;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete image");
    }
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds];
    try {
      await Promise.all(
        ids.map((imgId) => deleteImage.mutateAsync({ id: imgId, collectionId: id }))
      );
      toast.success(`${ids.length} image${ids.length !== 1 ? "s" : ""} deleted`);
      setSelectedIds(new Set());
      setShowBulkDelete(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete images");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/collections">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {collection?.name ?? (
                <Skeleton className="inline-block h-7 w-48" />
              )}
            </h1>
            <span className="mt-1 block text-sm text-muted-foreground" suppressHydrationWarning>
              {imagesLoading ? (
                <Skeleton className="inline-block h-4 w-24" />
              ) : (
                `${images.length} image${images.length !== 1 ? "s" : ""}`
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSelecting && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear ({selectedIds.size})
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowBulkDelete(true)}
              >
                <Trash2 className="size-4" />
                Delete Selected
              </Button>
            </>
          )}
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="size-4" />
            Upload Images
          </Button>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            ref={fileInputRef}
            onChange={handleHeaderUpload}
          />
        </div>
      </div>

      {/* Loading */}
      {imagesLoading && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <ImageSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state — full upload zone */}
      {!imagesLoading && !hasImages && (
        <ImageUploadZone collectionId={id} />
      )}

      {/* Image grid */}
      {!imagesLoading && hasImages && (
        <>
          {/* Compact upload zone above the grid */}
          <ImageUploadZone collectionId={id} compact />

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {images.map((image) => {
              const isSelected = selectedIds.has(image.id);
              return (
                <div
                  key={image.id}
                  className={cn(
                    "group relative aspect-square cursor-pointer overflow-hidden rounded-lg border-2 transition-all",
                    isSelected
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-transparent hover:border-primary/30"
                  )}
                  onClick={() => toggleSelect(image.id)}
                >
                  {image.url ? (
                    <img
                      src={image.url}
                      alt={image.filename}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <ImageIcon className="size-6 text-muted-foreground/40" />
                    </div>
                  )}

                  {/* Selection checkbox overlay */}
                  <div
                    className={cn(
                      "absolute left-2 top-2 flex size-5 items-center justify-center rounded-md border-2 transition-all",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-white/70 bg-black/20 opacity-0 group-hover:opacity-100"
                    )}
                  >
                    {isSelected && <Check className="size-3" />}
                  </div>

                  {/* Delete button overlay (single image) */}
                  {!isSelecting && (
                    <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="destructive"
                        size="icon-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImageToDelete(image);
                        }}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Single Delete Confirmation Dialog */}
      <Dialog
        open={!!imageToDelete}
        onOpenChange={(open) => {
          if (!open) setImageToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete image</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{imageToDelete?.filename}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImageToDelete(null)}
              disabled={deleteImage.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSingle}
              disabled={deleteImage.isPending}
            >
              {deleteImage.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog
        open={showBulkDelete}
        onOpenChange={(open) => {
          if (!open) setShowBulkDelete(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} images</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.size} selected image
              {selectedIds.size !== 1 ? "s" : ""}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkDelete(false)}
              disabled={deleteImage.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={deleteImage.isPending}
            >
              {deleteImage.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                `Delete ${selectedIds.size} Image${selectedIds.size !== 1 ? "s" : ""}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
