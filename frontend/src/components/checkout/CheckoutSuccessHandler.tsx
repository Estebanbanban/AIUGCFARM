"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PurchaseSuccessModal } from "@/components/checkout/PurchaseSuccessModal";
import type { PlanTier, CreditPackKey, SingleVideoPackKey } from "@/lib/stripe";
import { PLANS, CREDIT_PACKS, SINGLE_VIDEO_PACKS } from "@/lib/stripe";
import { trackPurchaseConfirmed } from "@/lib/datafast";
import type { Profile } from "@/types/database";
import { useGenerationWizardStore } from "@/stores/generation-wizard";
import { useApproveAndGenerate } from "@/hooks/use-generations";

export function CheckoutSuccessHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<PlanTier | null>(null);
  const [pack, setPack] = useState<CreditPackKey | SingleVideoPackKey | null>(null);
  const [onGenerateNow, setOnGenerateNow] = useState<(() => void) | undefined>(undefined);
  const isOnGeneratePage = pathname?.startsWith("/generate");
  const approveAndGenerate = useApproveAndGenerate();

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
        // Webhook has processed - server now returns the paid plan
        webhookConfirmed = true;
      } else if (fresh && fresh.plan === "free") {
        // Webhook hasn't processed yet - restore optimistic value
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
      // Poll credits every 2s for 15s so the balance updates as soon as the
      // webhook grants credits (avoids the "0 credits" flash if user clicks
      // Generate immediately after redirect).
      invalidateCreditsOnly();
      for (let t = 2_000; t <= 15_000; t += 2_000) {
        timers.push(setTimeout(invalidateCreditsOnly, t));
      }
    }

    // Track purchase regardless of page
    if (expectedPlan) {
      trackPurchaseConfirmed("subscription", expectedPlan);
    } else if (packParam && packParam in CREDIT_PACKS) {
      trackPurchaseConfirmed("credits", packParam);
    } else if (packParam && packParam in SINGLE_VIDEO_PACKS) {
      trackPurchaseConfirmed("credits", packParam);
    }

    // On /generate: show success modal with confetti, then stay on page.
    if (isOnGeneratePage) {
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      for (let t = 2_000; t <= 15_000; t += 2_000) {
        timers.push(setTimeout(invalidateCreditsOnly, t));
      }
      if (expectedPlan) {
        setPlan(expectedPlan as PlanTier);
        setOpen(true);
      } else if (packParam && packParam in CREDIT_PACKS) {
        setPack(packParam as CreditPackKey);
        setOpen(true);
      } else if (packParam && packParam in SINGLE_VIDEO_PACKS) {
        setPack(packParam as SingleVideoPackKey);
        setOpen(true);
      }

      // If the user was mid-generation when they hit the paywall, offer to
      // resume immediately after payment rather than making them click again.
      const pendingGenId = useGenerationWizardStore.getState().pendingGenerationId;
      const pendingScript = useGenerationWizardStore.getState().pendingScript;
      if (pendingGenId && pendingScript) {
        setOnGenerateNow(() => () => {
          approveAndGenerate.mutate({ generation_id: pendingGenId });
        });
      }

      router.replace(pathname!);
      return () => { timers.forEach(clearTimeout); };
    }

    // Dashboard flow: show modal + navigate
    if (expectedPlan) {
      setPlan(expectedPlan as PlanTier);
      setOpen(true);
      router.replace("/dashboard");
    } else if (packParam && packParam in CREDIT_PACKS) {
      setPack(packParam as CreditPackKey);
      setOpen(true);
      router.replace("/dashboard");
    } else if (packParam && packParam in SINGLE_VIDEO_PACKS) {
      setPack(packParam as SingleVideoPackKey);
      setOpen(true);
      router.replace("/dashboard");
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [searchParams, router, queryClient, pathname, isOnGeneratePage, approveAndGenerate]);

  const handleClose = () => {
    setOpen(false);
    if (!isOnGeneratePage) {
      router.replace("/dashboard");
    }
  };

  return (
    <PurchaseSuccessModal
      open={open}
      onClose={handleClose}
      plan={plan}
      pack={pack}
      onGenerateNow={onGenerateNow}
    />
  );
}
