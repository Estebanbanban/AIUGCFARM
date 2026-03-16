"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, List, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSlideshowHooks, useGenerateHooks } from "@/hooks/use-slideshow-hooks";
import { useSlideshowEditorStore } from "@/stores/slideshow-editor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function HookSelector() {
  const store = useSlideshowEditorStore();
  const { data: hooks = [], isLoading } = useSlideshowHooks(store.productId ?? undefined);
  const generateHooks = useGenerateHooks();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAllHooks, setShowAllHooks] = useState(false);

  const totalHooks = hooks.length;

  // Reset index when hooks data changes (e.g. after generation)
  useEffect(() => {
    if (currentIndex >= totalHooks && totalHooks > 0) {
      setCurrentIndex(0);
    }
  }, [totalHooks, currentIndex]);

  const currentHook = hooks[currentIndex];

  const goNext = () => {
    if (totalHooks === 0) return;
    const next = (currentIndex + 1) % totalHooks;
    setCurrentIndex(next);
    // Auto-apply hook text when browsing
    if (hooks[next]) store.applyHookToFirstSlide(hooks[next].text);
  };

  const goPrev = () => {
    if (totalHooks === 0) return;
    const prev = (currentIndex - 1 + totalHooks) % totalHooks;
    setCurrentIndex(prev);
    if (hooks[prev]) store.applyHookToFirstSlide(hooks[prev].text);
  };

  const selectHook = (text: string, hookIndex?: number) => {
    store.applyHookToFirstSlide(text);
    // Sync carousel index to the selected hook
    if (hookIndex !== undefined) {
      setCurrentIndex(hookIndex);
    } else {
      const idx = hooks.findIndex((h) => h.text === text);
      if (idx >= 0) setCurrentIndex(idx);
    }
    setShowAllHooks(false);
  };

  const handleGenerate = () => {
    generateHooks.mutate({
      product_id: store.productId || undefined,
      count: 10,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">Hook</label>
        {totalHooks > 0 && (
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1}/{totalHooks}
          </span>
        )}
      </div>

      {/* Hook carousel */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={goPrev}
          disabled={totalHooks <= 1}
        >
          <ChevronLeft className="size-4" />
        </Button>

        <div
          className={cn(
            "flex-1 min-h-[60px] rounded-lg border border-border bg-background p-3 text-sm cursor-pointer transition-colors hover:border-primary/40",
            currentHook && "text-foreground",
            !currentHook && "text-muted-foreground italic",
          )}
          onClick={() => currentHook && selectHook(currentHook.text)}
        >
          {isLoading ? (
            <span className="text-muted-foreground">Loading hooks...</span>
          ) : currentHook ? (
            <span className="lowercase line-clamp-3">{currentHook.text}</span>
          ) : (
            <span>No hooks yet. Generate some below.</span>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={goNext}
          disabled={totalHooks <= 1}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => setShowAllHooks(true)}
          disabled={totalHooks === 0}
        >
          <List className="size-3.5" />
          All Hooks
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleGenerate}
          disabled={generateHooks.isPending}
        >
          {generateHooks.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          Generate Hooks
        </Button>
      </div>

      {/* All Hooks Dialog */}
      <Dialog open={showAllHooks} onOpenChange={setShowAllHooks}>
        <DialogContent className="sm:max-w-lg max-h-[70vh]">
          <DialogHeader>
            <DialogTitle>All Hooks ({totalHooks})</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 overflow-y-auto max-h-[50vh] pr-1">
            {hooks.map((hook, idx) => (
              <button
                key={hook.id}
                className={cn(
                  "w-full text-left rounded-lg border border-border p-3 text-sm transition-colors hover:border-primary/40 hover:bg-accent/30 lowercase",
                  hook.text === store.hookText && "border-primary bg-primary/5",
                )}
                onClick={() => selectHook(hook.text, idx)}
              >
                {hook.text}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
