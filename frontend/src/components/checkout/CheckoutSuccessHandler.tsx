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
    const expectedPlan =
      planParam && planParam in PLANS ? planParam : null;

    // Cancel any in-flight profile query so it can't overwrite our optimistic update
    queryClient.cancelQueries({ queryKey: ["profile"] });

    // Optimistically update the profile cache so the dashboard shows the new plan
    // instantly, even before the Stripe webhook has processed.
    if (expectedPlan) {
      queryClient.setQueryData<Profile>(["profile"], (old) => {
        if (!old) return old;
        return { ...old, plan: expectedPlan as Profile["plan"] };
      });
    }

    // Smart refresh: refetch from server, but protect the optimistic value
    // until the webhook has actually processed the payment.
    let webhookConfirmed = false;

    const smartRefresh = async () => {
      if (webhookConfirmed) return;
      await queryClient.refetchQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });

      if (!expectedPlan) return;

      const fresh = queryClient.getQueryData<Profile>(["profile"]);
      if (fresh && fresh.plan !== "free") {
        // Webhook has processed — server now returns the paid plan
        webhookConfirmed = true;
      } else if (fresh && fresh.plan === "free") {
        // Webhook hasn't processed yet — restore optimistic value
        queryClient.setQueryData<Profile>(["profile"], (old) => {
          if (!old) return old;
          return { ...old, plan: expectedPlan as Profile["plan"] };
        });
      }
    };

    const invalidateCreditsOnly = () => {
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    };

    const timers: ReturnType<typeof setTimeout>[] = [];

    if (expectedPlan) {
      // Staggered retries to catch webhook processing
      timers.push(setTimeout(smartRefresh, 3_000));
      timers.push(setTimeout(smartRefresh, 8_000));
      timers.push(setTimeout(smartRefresh, 15_000));
      timers.push(setTimeout(smartRefresh, 30_000));
      timers.push(setTimeout(smartRefresh, 60_000));
    } else {
      invalidateCreditsOnly();
      timers.push(setTimeout(invalidateCreditsOnly, 4_000));
      timers.push(setTimeout(invalidateCreditsOnly, 10_000));
    }

    if (expectedPlan) {
      trackPurchaseConfirmed("subscription", expectedPlan);
      setPlan(expectedPlan as PlanTier);
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
      timers.forEach(clearTimeout);
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
