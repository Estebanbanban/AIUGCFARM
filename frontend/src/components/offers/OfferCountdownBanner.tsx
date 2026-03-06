"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useFirstPurchaseOffer } from "@/hooks/use-first-purchase-offer";

const DISMISS_KEY = "offer_banner_dismissed";

export function OfferCountdownBanner() {
  const offer = useFirstPurchaseOffer();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  const visible = offer.isActive && !dismissed;

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -44, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -44, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="sticky top-0 left-0 right-0 z-50 h-[44px] bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white"
        >
          <div className="flex h-full items-center justify-center gap-3 px-4 text-sm font-medium">
            <span className="hidden sm:inline">
              Limited offer: 50% off your first video + 30% off all plans, expires in{" "}
              <span className="font-bold tabular-nums">{offer.timeDisplay}</span>
            </span>
            <span className="sm:hidden">
              50% off first video -<span className="font-bold tabular-nums">{offer.timeDisplay}</span>
            </span>
            <button
              onClick={() => router.push("/generate")}
              className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold transition-colors hover:bg-white/30"
            >
              Get it now &rarr;
            </button>
            <button
              onClick={handleDismiss}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 transition-colors hover:bg-white/20"
              aria-label="Dismiss banner"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
