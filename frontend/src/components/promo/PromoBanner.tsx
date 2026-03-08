"use client";

import { Flame, Clock, X } from "lucide-react";
import { useFirstPurchaseOffer } from "@/hooks/use-first-purchase-offer";

export function PromoBanner() {
  const offer = useFirstPurchaseOffer();

  if (!offer.isActive) return null;

  return (
    <div className="sticky top-0 z-50 w-full bg-primary px-4 py-2 text-sm text-primary-foreground">
      <div className="relative flex items-center justify-center gap-2">
        <Flame className="h-4 w-4 shrink-0" />
        <span className="font-bold">Limited offer</span>
        <span className="opacity-60">&mdash;</span>
        <span>-50% on first video &middot; -30% on all plans</span>
        <div className="ml-3 flex items-center gap-1 font-mono">
          <Clock className="h-3 w-3 opacity-80" />
          <span>{offer.timeDisplay}</span>
        </div>
        <button
          onClick={offer.markUsed}
          className="absolute right-0 rounded p-0.5 hover:bg-primary-foreground/20"
          aria-label="Dismiss offer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
