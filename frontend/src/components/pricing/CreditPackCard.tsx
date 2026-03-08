"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { callEdge } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CreditPackKey } from "@/lib/stripe";

interface Pack {
  name: string;
  credits: number;
  price: number;
  pricePerCredit: number;
  badge?: string;
}

interface CreditPackCardProps {
  packKey: CreditPackKey;
  pack: Pack;
  videosStandard: number;
  videosHd: number;
  tripleStandard: number;
  combosTriple: number;
}

export function CreditPackCard({
  packKey,
  pack,
  videosStandard,
  videosHd,
  tripleStandard,
  combosTriple,
}: CreditPackCardProps) {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isBestValue = pack.badge === "Best value";

  async function handleClick() {
    if (!isSignedIn) {
      router.push(`/sign-up?pack=${packKey}`);
      return;
    }
    setLoading(true);
    try {
      const res = await callEdge<{ data: { url: string } }>("stripe-checkout", {
        body: { pack: packKey },
      });
      window.location.href = res.data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border p-5 transition-all duration-200",
        isBestValue
          ? "border-primary/40 bg-card shadow-[0_0_30px_rgba(249,115,22,0.06)]"
          : "border-border bg-card hover:border-primary/30"
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <h3 className="font-semibold text-foreground">{pack.name}</h3>
        {pack.badge && (
          <Badge variant="secondary" className={cn("text-xs", isBestValue && "bg-primary/10 text-primary")}>
            {pack.badge}
          </Badge>
        )}
      </div>

      <div className="mb-1 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-foreground">${pack.price}</span>
      </div>
      <p className="mb-4 text-xs text-primary">${pack.pricePerCredit}/credit</p>

      <ul className="mb-5 flex flex-1 flex-col gap-2 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <Check className="size-3.5 shrink-0 text-primary" strokeWidth={2.5} />
          <strong className="text-foreground">{pack.credits} credits</strong>
        </li>
        <li className="flex items-center gap-2">
          <Check className="size-3.5 shrink-0 text-primary" strokeWidth={2.5} />
          {videosStandard} Budget or {videosHd} Premium videos
        </li>
        {tripleStandard > 0 && (
          <li className="flex items-center gap-2">
            <Check className="size-3.5 shrink-0 text-emerald-400" strokeWidth={2.5} />
            <span>
              {tripleStandard} Triple batch{tripleStandard > 1 ? "es" : ""} ={" "}
              <strong className="text-foreground">{combosTriple} ad combos</strong>
            </span>
          </li>
        )}
        <li className="flex items-center gap-2">
          <Check className="size-3.5 shrink-0 text-primary" strokeWidth={2.5} />
          Never expire
        </li>
      </ul>

      <button
        onClick={handleClick}
        disabled={loading}
        className={cn(
          "w-full rounded-full py-2.5 text-center text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed",
          isBestValue
            ? "bg-primary text-white hover:bg-orange-600"
            : "border border-border text-foreground hover:border-primary/40"
        )}
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Buy Now"}
      </button>
    </div>
  );
}
