"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSlideshowEditorStore } from "@/stores/slideshow-editor";
import { useGenerateSlideCopy } from "@/hooks/use-slide-copy";
import { useCredits } from "@/hooks/use-credits";
import { toast } from "sonner";

export function GenerateButton() {
  const store = useSlideshowEditorStore();
  const generateCopy = useGenerateSlideCopy();
  const { data: credits } = useCredits();
  const [copyLength, setCopyLength] = useState<"short" | "long">("long");

  const bodySlideCount = store.slides.filter(
    (s) => s.type === "body" || s.type === "cta",
  ).length;

  const canGenerate =
    !!store.hookText &&
    bodySlideCount > 0 &&
    !generateCopy.isPending;

  const handleGenerate = () => {
    if (!store.hookText) {
      toast.error("Please set a hook text first");
      return;
    }

    const bodySlideCount = store.slides.filter(
      (s) => s.type === "body" || s.type === "cta",
    ).length;

    if (bodySlideCount === 0) {
      toast.error("Add at least one body slide before generating");
      return;
    }

    generateCopy.mutate(
      {
        hook_text: store.hookText,
        product_id: store.productId ?? undefined,
        slide_count: bodySlideCount,
        copy_length: copyLength,
      },
      {
        onSuccess: (slides) => {
          store.applyGeneratedCopy(slides);
          toast.success("Body copy generated successfully");
        },
        onError: (err) => {
          toast.error(err.message || "Failed to generate copy");
        },
      },
    );
  };

  return (
    <div className="space-y-2">
      {/* Copy length toggle */}
      <div className="flex items-center gap-1.5">
        {(["short", "long"] as const).map((len) => (
          <button
            key={len}
            className={cn(
              "flex-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors capitalize",
              copyLength === len
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/40",
            )}
            onClick={() => setCopyLength(len)}
          >
            {len === "short" ? "Short copy" : "Detailed copy"}
          </button>
        ))}
      </div>

      <Button
        className="w-full h-10 text-sm font-semibold gap-2"
        onClick={handleGenerate}
        disabled={!canGenerate}
      >
        {generateCopy.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
        Generate Body Copy
        {credits && (
          <Badge variant="secondary" className="ml-1 text-xs">
            {credits.is_unlimited
              ? "unlimited"
              : `${credits.remaining} credits`}
          </Badge>
        )}
      </Button>
      {!store.hookText && (
        <p className="text-xs text-muted-foreground text-center">
          Select or write a hook first
        </p>
      )}
    </div>
  );
}
