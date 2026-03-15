"use client";

import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSlideshowEditorStore } from "@/stores/slideshow-editor";
import { useGenerateSlideCopy } from "@/hooks/use-slide-copy";
import { useCredits } from "@/hooks/use-credits";
import { toast } from "sonner";

export function GenerateButton() {
  const store = useSlideshowEditorStore();
  const generateCopy = useGenerateSlideCopy();
  const { data: credits } = useCredits();

  const canGenerate =
    !!store.hookText &&
    store.slides.length > 1 &&
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
      <Button
        className="w-full h-12 text-base font-semibold gap-2"
        onClick={handleGenerate}
        disabled={!canGenerate}
      >
        {generateCopy.isPending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Sparkles className="size-5" />
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
