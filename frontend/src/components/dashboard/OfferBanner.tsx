"use client";

import { useState } from "react";
import Link from "next/link";
import { X, Zap } from "lucide-react";
import { useFirstPurchaseOffer } from "@/hooks/use-first-purchase-offer";

export function OfferBanner() {
  const [dismissed, setDismissed] = useState(false);
  const offer = useFirstPurchaseOffer();

  if (!offer.isActive || dismissed) return null;

  return (
    <div className="z-50 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-2.5 px-4 flex items-center justify-center gap-3 text-sm font-medium shrink-0">
      <Zap className="size-4 shrink-0" />
      <span>
        <strong>30% off</strong> any plan · expires in{" "}
        <strong className="font-mono">{offer.timeDisplay}</strong>
      </span>
      <Link
        href="/settings/billing"
        className="ml-auto shrink-0 rounded-md bg-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/30 transition-colors"
      >
        Get Credits Now
      </Link>
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
