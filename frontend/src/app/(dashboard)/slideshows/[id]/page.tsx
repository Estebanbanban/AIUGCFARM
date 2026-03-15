"use client";

import { useParams } from "next/navigation";
import { useSlideshow, useUpdateSlideshow } from "@/hooks/use-slideshows";
import { useSlideshowEditorStore } from "@/stores/slideshow-editor";
import { useEffect, useRef } from "react";
import { SlideshowEditorLayout } from "@/components/slideshows/SlideshowEditorLayout";
import { SlideshowGallery } from "@/components/slideshows/SlideshowGallery";
import { Skeleton } from "@/components/ui/skeleton";

function EditorSkeleton() {
  return (
    <div className="flex flex-col" style={{ height: "70vh" }}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-9 w-20" />
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-[400px] shrink-0 border-r border-border p-5 space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        <div className="flex-1 p-5 flex items-start justify-center gap-4">
          <Skeleton className="w-[180px] rounded-lg" style={{ aspectRatio: "9 / 16" }} />
          <Skeleton className="w-[180px] rounded-lg" style={{ aspectRatio: "9 / 16" }} />
        </div>
      </div>
    </div>
  );
}

export default function SlideshowEditorPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: slideshow, isLoading } = useSlideshow(id);
  const store = useSlideshowEditorStore();
  const updateSlideshow = useUpdateSlideshow();

  // Load slideshow into store on first load
  useEffect(() => {
    if (slideshow && store.slideshowId !== slideshow.id) {
      store.loadSlideshow(
        slideshow.id,
        slideshow.name,
        slideshow.settings,
        slideshow.slides,
        slideshow.hook_text,
        slideshow.product_id,
        slideshow.status,
      );
    }
  }, [slideshow]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save debounced
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!store.isDirty || !store.slideshowId) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      updateSlideshow.mutate({
        id: store.slideshowId!,
        name: store.name,
        settings: store.settings,
        slides: store.slides,
        hook_text: store.hookText ?? undefined,
      });
    }, 2000);
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [store.isDirty, store.slides, store.settings, store.name, store.hookText]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col">
      {/* Editor section — fixed height */}
      <div style={{ height: "70vh", minHeight: "550px" }}>
        {isLoading ? <EditorSkeleton /> : <SlideshowEditorLayout />}
      </div>

      {/* Gallery section — below editor */}
      <SlideshowGallery currentSlideshowId={id} />
    </div>
  );
}
