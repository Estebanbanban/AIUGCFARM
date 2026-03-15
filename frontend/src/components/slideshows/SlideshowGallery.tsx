"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSlideshows, useCreateSlideshow } from "@/hooks/use-slideshows";
import { ExportedSlideshowCard } from "./ExportedSlideshowCard";
import type { Slide } from "@/types/slideshow";

export function SlideshowGallery({ currentSlideshowId }: { currentSlideshowId?: string }) {
  const router = useRouter();
  const { data } = useSlideshows();
  const slideshows = data?.slideshows ?? [];
  const createSlideshow = useCreateSlideshow();
  const [activeTab, setActiveTab] = useState<"exported" | "drafts">("exported");

  const exported = slideshows.filter((s) => s.exported_at);
  const drafts = slideshows.filter((s) => !s.exported_at);
  const activeList = activeTab === "exported" ? exported : drafts;

  const handleNewSlideshow = () => {
    const defaultSlides: Slide[] = [
      { id: crypto.randomUUID(), type: "hook", order: 0, imageId: null, imageUrl: null, text: "" },
      { id: crypto.randomUUID(), type: "body", order: 1, imageId: null, imageUrl: null, text: "" },
      { id: crypto.randomUUID(), type: "body", order: 2, imageId: null, imageUrl: null, text: "" },
      { id: crypto.randomUUID(), type: "body", order: 3, imageId: null, imageUrl: null, text: "" },
      { id: crypto.randomUUID(), type: "cta", order: 4, imageId: null, imageUrl: null, text: "" },
    ];
    createSlideshow.mutate(
      { name: "Untitled Slideshow", slides: defaultSlides },
      {
        onSuccess: (slideshow) => router.push(`/slideshows/${slideshow.id}`),
      },
    );
  };

  return (
    <div className="border-t border-border bg-card/30 px-6 py-5 space-y-4">
      {/* Tabs + New button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            className={cn(
              "text-lg font-semibold transition-colors",
              activeTab === "exported" ? "text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground",
            )}
            onClick={() => setActiveTab("exported")}
          >
            Exported Slideshows ({exported.length})
          </button>
          <button
            className={cn(
              "text-lg font-semibold transition-colors",
              activeTab === "drafts" ? "text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground",
            )}
            onClick={() => setActiveTab("drafts")}
          >
            Drafts ({drafts.length})
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleNewSlideshow}
          disabled={createSlideshow.isPending}
        >
          <Plus className="size-3.5" />
          New Slideshow
        </Button>
      </div>

      {/* Card grid */}
      {activeList.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {activeList.map((slideshow) => (
            <ExportedSlideshowCard
              key={slideshow.id}
              slideshow={slideshow}
              onClick={() => {
                if (slideshow.id !== currentSlideshowId) {
                  router.push(`/slideshows/${slideshow.id}`);
                }
              }}
            />
          ))}

          {/* Plus button to create new */}
          <button
            className="rounded-lg border-2 border-dashed border-border/40 hover:border-primary/40 transition-colors flex items-center justify-center"
            style={{ aspectRatio: "9 / 16" }}
            onClick={handleNewSlideshow}
          >
            <Plus className="size-8 text-muted-foreground/40" />
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {activeTab === "exported"
              ? "No exported slideshows yet. Create one and hit Export ZIP."
              : "No drafts. Click New Slideshow to get started."}
          </p>
        </div>
      )}
    </div>
  );
}
