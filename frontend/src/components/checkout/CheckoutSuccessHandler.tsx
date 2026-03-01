"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { PurchaseSuccessModal } from "@/components/checkout/PurchaseSuccessModal";
import type { PlanTier, CreditPackKey } from "@/lib/stripe";
import { PLANS, CREDIT_PACKS, SINGLE_VIDEO_PACKS } from "@/lib/stripe";
import { trackPurchaseConfirmed } from "@/lib/datafast";
import type { Profile } from "@/types/database";

export function CheckoutSuccessHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<PlanTier | null>(null);
  const [pack, setPack] = useState<CreditPackKey | null>(null);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout !== "success") return;

    // Require session_id from Stripe to prevent manual URL spoofing
    const sessionId = searchParams.get("session_id");
    if (!sessionId || !sessionId.startsWith("cs_")) return;

    const planParam = searchParams.get("plan");
    const packParam = searchParams.get("pack");

    // Optimistically update the profile cache so the dashboard shows the new plan
    // instantly, even before the Stripe webhook has processed.
    if (planParam && planParam in PLANS) {
      queryClient.setQueryData<Profile>(["profile"], (old) => {
        if (!old) return old;
        return { ...old, plan: planParam as Profile["plan"] };
      });
    }

    // Also invalidate to refetch the real data from the server once the webhook processes.
    // Retry a few times to account for Stripe webhook processing delay.
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    };
    invalidate();
    const t1 = setTimeout(invalidate, 2000);
    const t2 = setTimeout(invalidate, 5000);
    const t3 = setTimeout(invalidate, 10000);

    if (planParam && planParam in PLANS) {
      trackPurchaseConfirmed("subscription", planParam);
      setPlan(planParam as PlanTier);
      setOpen(true);
      router.replace("/dashboard");
    } else if (packParam && packParam in CREDIT_PACKS) {
      trackPurchaseConfirmed("credits", packParam);
      setPack(packParam as CreditPackKey);
      setOpen(true);
      router.replace("/dashboard");
    } else if (packParam && packParam in SINGLE_VIDEO_PACKS) {
      // Single video packs (single_standard / single_hd) — treat as credit pack
      trackPurchaseConfirmed("credits", packParam);
      // Map to pack_10 for modal display (closest credit pack)
      setPack("pack_10" as CreditPackKey);
      setOpen(true);
      router.replace("/dashboard");
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [searchParams, router, queryClient]);

  const handleClose = () => {
    setOpen(false);
    router.replace("/dashboard");
  };

  return (
    <PurchaseSuccessModal
      open={open}
      onClose={handleClose}
      plan={plan}
      pack={pack}
    />
  );
}
