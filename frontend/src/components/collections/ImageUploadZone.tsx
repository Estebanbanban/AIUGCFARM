"use client";

import { useState, useRef } from "react";
import { Upload, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useUploadCollectionImages } from "@/hooks/use-collections";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

interface ImageUploadZoneProps {
  collectionId: string;
  onUploadComplete?: () => void;
  compact?: boolean;
}

export function ImageUploadZone({
  collectionId,
  onUploadComplete,
  compact = false,
}: ImageUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadCollectionImages();

  function validateFiles(files: File[]): File[] {
    const valid: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        errors.push(`"${file.name}" is not a supported format (JPEG, PNG, WebP only)`);
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        errors.push(`"${file.name}" exceeds 10MB limit`);
        continue;
      }
      valid.push(file);
    }

    if (errors.length > 0) {
      toast.error(errors.length === 1 ? errors[0] : `${errors.length} files skipped: invalid format or too large`);
    }

    return valid;
  }

  function handleUpload(files: File[]) {
    const valid = validateFiles(files);
    if (valid.length === 0) return;

    uploadMutation.mutate(
      { collectionId, files: valid },
      {
        onSuccess: (data) => {
          toast.success(`${data.uploaded} image${data.uploaded !== 1 ? "s" : ""} uploaded`);
          onUploadComplete?.();
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to upload images");
        },
      }
    );
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      ACCEPTED_TYPES.includes(f.type)
    );
    if (files.length > 0) handleUpload(files);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleUpload(files);
    // Reset input so the same file(s) can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div
      className={cn(
        "relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-muted/30",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-12",
        uploadMutation.isPending && "pointer-events-none opacity-60"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileSelect}
      />

      {uploadMutation.isPending ? (
        <>
          <Loader2 className={cn("animate-spin text-primary", compact ? "size-6" : "size-8")} />
          <p className="text-sm text-muted-foreground">Uploading images...</p>
        </>
      ) : (
        <>
          <Upload className={cn("text-muted-foreground", compact ? "size-6" : "size-8")} />
          <div className="text-center">
            <p className={cn("font-medium text-foreground", compact ? "text-sm" : "text-base")}>
              {isDragging ? "Drop images here" : "Drag images here or click to browse"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPEG, PNG, or WebP &middot; Max 10MB per file
            </p>
          </div>
        </>
      )}
    </div>
  );
}
