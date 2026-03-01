"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  toastId: string | number;
  generationId: string;
  productName?: string;
}

export function GenerationCompleteNotification({ toastId, generationId, productName }: Props) {
  const router = useRouter();

  return (
    <div className="flex w-80 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
            <Check className="size-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Your video is ready</p>
            {productName && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {productName} ad finished rendering
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => toast.dismiss(toastId)}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
      <Button
        size="sm"
        className="w-full"
        onClick={() => {
          toast.dismiss(toastId);
          router.push(`/generate/${generationId}`);
        }}
      >
        View result →
      </Button>
    </div>
  );
}
