"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PurchaseSuccessModal } from "@/components/checkout/PurchaseSuccessModal";
import type { PlanTier, CreditPackKey } from "@/lib/stripe";
import { PLANS, CREDIT_PACKS } from "@/lib/stripe";
import { trackPurchaseConfirmed } from "@/lib/datafast";

export function CheckoutSuccessHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<PlanTier | null>(null);
  const [pack, setPack] = useState<CreditPackKey | null>(null);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout !== "success") return;

    const planParam = searchParams.get("plan");
    const packParam = searchParams.get("pack");

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
    }
  }, [searchParams, router]);

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
