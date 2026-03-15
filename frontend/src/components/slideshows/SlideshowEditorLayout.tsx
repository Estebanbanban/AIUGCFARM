"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSlideshowEditorStore } from "@/stores/slideshow-editor";
import { useUpdateSlideshow } from "@/hooks/use-slideshows";
import { EditorControlPanel } from "./EditorControlPanel";
import { PreviewCanvas } from "./PreviewCanvas";
import { toast } from "sonner";

export function SlideshowEditorLayout() {
  const router = useRouter();
  const store = useSlideshowEditorStore();
  const updateSlideshow = useUpdateSlideshow();

  const handleSave = () => {
    if (!store.slideshowId) return;
    updateSlideshow.mutate(
      {
        id: store.slideshowId,
        name: store.name,
        settings: store.settings,
        slides: store.slides,
        hook_text: store.hookText ?? undefined,
      },
      {
        onSuccess: () => toast.success("Slideshow saved"),
        onError: (err) => toast.error(err.message || "Failed to save"),
      },
    );
  };

  const statusColor = {
    draft: "outline" as const,
    rendering: "secondary" as const,
    complete: "default" as const,
    failed: "destructive" as const,
  };

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.push("/slideshows")}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-sm font-semibold truncate max-w-[200px]">
            {store.name || "Untitled Slideshow"}
          </h1>
          <Badge variant={statusColor[store.status]}>
            {store.status}
          </Badge>
          {store.isDirty && (
            <span className="text-xs text-muted-foreground italic">
              unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={!store.isDirty || updateSlideshow.isPending}
          >
            {updateSlideshow.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : store.isDirty ? (
              <Save className="size-3.5" />
            ) : (
              <CheckCircle2 className="size-3.5 text-green-500" />
            )}
            {updateSlideshow.isPending ? "Saving..." : store.isDirty ? "Save" : "Saved"}
          </Button>
        </div>
      </div>

      {/* Main content: two-column layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel - controls */}
        <div className="w-[440px] shrink-0 border-r border-border bg-card overflow-hidden">
          <EditorControlPanel />
        </div>

        {/* Right panel - preview */}
        <div className="flex-1 bg-background overflow-auto">
          <PreviewCanvas />
        </div>
      </div>
    </div>
  );
}
