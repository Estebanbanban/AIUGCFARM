"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, X, Video, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface ScreenRecordingUploadProps {
  userId: string;
  storagePath: string | null;
  onUpload: (path: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);
const ACCEPT_STRING = "video/mp4,video/quicktime,video/webm";
const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB
const BUCKET = "screen-recordings";

function getFilenameFromPath(path: string): string {
  return path.split("/").pop() || path;
}

export function ScreenRecordingUpload({
  userId,
  storagePath,
  onUpload,
  onRemove,
  disabled = false,
}: ScreenRecordingUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.has(file.type)) {
        toast.error("Only MP4, MOV, and WebM files are supported.");
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error("File size must be under 500 MB.");
        return;
      }
      if (!userId) {
        toast.error("Please wait for authentication to load.");
        return;
      }

      setUploading(true);
      setProgress(10);

      try {
        const ext = file.name.split(".").pop() || "mp4";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;

        const supabase = createClient();
        setProgress(30);

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        setProgress(100);
        onUpload(path);
        toast.success("Screen recording uploaded.");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to upload recording"
        );
      } finally {
        setUploading(false);
        setProgress(0);
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      }
    },
    [userId, onUpload]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleRemove = useCallback(() => {
    onRemove();
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [onRemove]);

  // Uploaded state — show file info with remove button
  if (storagePath && !uploading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex size-10 items-center justify-center rounded bg-primary/10">
          <Video className="size-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {getFilenameFromPath(storagePath)}
          </p>
          <p className="text-xs text-muted-foreground">Screen recording uploaded</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleRemove}
          disabled={disabled}
          className="shrink-0"
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  // Uploading state
  if (uploading) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>Uploading... {progress}%</span>
        </div>
        <Progress value={progress} />
      </div>
    );
  }

  // Default — drop zone
  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors",
        isDragOver
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <Video className="size-8 text-muted-foreground" />
      <div className="text-center">
        <p className="text-sm font-medium">Upload screen recording</p>
        <p className="text-xs text-muted-foreground">
          MP4, MOV, or WebM — max 500 MB
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
      >
        <Upload className="size-4" />
        Choose file
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_STRING}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
