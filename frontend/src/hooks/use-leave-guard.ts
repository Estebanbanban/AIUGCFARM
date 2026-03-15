"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export function useLeaveGuard(isDirty: boolean) {
  const [showDialog, setShowDialog] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const router = useRouter();

  // In-app navigation: intercept <Link> clicks via capture-phase listener
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: MouseEvent) => {
      const link = (e.target as Element).closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto")) return;
      // Don't block navigation within /generate itself
      if (href.startsWith("/generate")) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(href);
      setShowDialog(true);
    };
    document.addEventListener("click", handler, true); // capture phase — fires before React handlers
    return () => document.removeEventListener("click", handler, true);
  }, [isDirty]);

  const confirmLeave = useCallback(() => {
    setShowDialog(false);
    if (pendingHref) {
      router.push(pendingHref);
      setPendingHref(null);
    }
  }, [pendingHref, router]);

  const cancelLeave = useCallback(() => {
    setShowDialog(false);
    setPendingHref(null);
  }, []);

  return { showDialog, confirmLeave, cancelLeave };
}
