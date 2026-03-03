"use client";

import { useState } from "react";
import { X, Zap } from "lucide-react";
import { useFirstPurchaseOffer } from "@/hooks/use-first-purchase-offer";

export function OfferBanner() {
  const [dismissed, setDismissed] = useState(false);
  const offer = useFirstPurchaseOffer();

  if (!offer.isActive || dismissed) return null;

  return (
    <div className="sticky top-0 z-50 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-2.5 px-4 flex items-center justify-center gap-3 text-sm font-medium">
      <Zap className="size-4 shrink-0" />
      <span>
        <strong>30% off</strong> any plan · expires in{" "}
        <strong className="font-mono">{offer.timeDisplay}</strong>
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
