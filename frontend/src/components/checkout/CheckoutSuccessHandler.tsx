"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PurchaseSuccessModal } from "@/components/checkout/PurchaseSuccessModal";
import type { PlanTier, CreditPackKey } from "@/lib/stripe";
import { PLANS, CREDIT_PACKS } from "@/lib/stripe";

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
      setPlan(planParam as PlanTier);
      setOpen(true);
    } else if (packParam && packParam in CREDIT_PACKS) {
      setPack(packParam as CreditPackKey);
      setOpen(true);
    }
  }, [searchParams]);

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
