"use client";

import { useState, useEffect } from "react";
import { Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function FirstVideoDiscountBanner() {
  const [show, setShow] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check localStorage dismiss first (fast)
    if (localStorage.getItem("discount-banner-dismissed") === "true") {
      setDismissed(true);
      return;
    }

    // Check if user is already subscribed
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("plan, first_video_discount_used")
      .maybeSingle()
      .then(({ data }: { data: { plan?: string; first_video_discount_used?: boolean } | null }) => {
        if (
          data?.plan !== "free" ||
          data?.first_video_discount_used === true
        ) {
          setShow(false);
        }
      });
  }, []);

  if (!show || dismissed) return null;

  return (
    <div className="sticky top-0 z-50 bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2.5 px-4 flex items-center justify-center gap-3 text-sm font-medium">
      <Sparkles className="size-4 shrink-0" />
      <span>
        Your first video is <strong>50% OFF</strong>, applied automatically at
        checkout. No code needed.
      </span>
      <button
        onClick={() => {
          setDismissed(true);
          localStorage.setItem("discount-banner-dismissed", "true");
        }}
        className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
