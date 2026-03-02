"use client";

import { useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Zap,
  Film,
  Users,
  Sparkles,
  TrendingUp,
  Video,
} from "lucide-react";
import { PLANS, CREDIT_PACKS, type PlanTier, type CreditPackKey } from "@/lib/stripe";
import { cn } from "@/lib/utils";

interface PurchaseSuccessModalProps {
  open: boolean;
  onClose: () => void;
  plan?: PlanTier | null;
  pack?: CreditPackKey | null;
}

const PLAN_PERKS: Record<PlanTier, { icon: React.ElementType; headline: string; sub: string; bullets: string[]; highlight: string }> = {
  starter: {
    icon: Zap,
    headline: "You're officially live. 🎬",
    sub: "Your Starter plan is active - you have everything you need to launch your first AI UGC campaign.",
    highlight: "30 credits loaded · 6 standard videos ready to go",
    bullets: [
      "30 monthly credits (renews automatically)",
      "Create up to 6 standard videos per month",
      "1 AI persona to represent your brand",
      "1 brand profile with full UGC pipeline",
      "720p MP4 export, ready for any platform",
      "AI-written hooks, bodies, and CTAs",
    ],
  },
  growth: {
    icon: TrendingUp,
    headline: "Time to scale your ad creative. 🚀",
    sub: "Growth unlocked - you now have the bandwidth to run serious A/B tests and fill your content calendar.",
    highlight: "100 credits loaded · 20 standard or 10 HD videos",
    bullets: [
      "100 monthly credits (renews automatically)",
      "Up to 20 standard or 10 HD videos per month",
      "3 AI personas - test different voices & styles",
      "3 brand profiles for multi-product campaigns",
      "1080p HD export for premium ad placements",
      "Custom script editor + priority generation queue",
    ],
  },
  scale: {
    icon: Sparkles,
    headline: "Full creative bandwidth. No limits. ✨",
    sub: "You're running at full scale now. Spin up campaigns faster than any creative team.",
    highlight: "250 credits loaded · 50 standard or 25 HD videos",
    bullets: [
      "250 monthly credits (renews automatically)",
      "Up to 50 standard or 25 HD videos per month",
      "10 AI personas - cover every audience segment",
      "10 brand profiles for full portfolio management",
      "1080p export + priority support",
      "Custom scripts, fastest generation queue",
    ],
  },
};

const PACK_PERKS: Record<CreditPackKey, { headline: string; sub: string; highlight: string; bullets: string[] }> = {
  pack_10: {
    headline: "Credits loaded. Let's make something. 🎬",
    sub: "Your 10 credits are ready to use right now. That's 2 complete video ads - go test your first hook.",
    highlight: "10 credits added to your account",
    bullets: [
      "2 standard videos (Hook → Body → CTA)",
      "Or 1 HD video for premium placements",
      "Full AI script generation included",
      "MP4 download, no watermarks",
    ],
  },
  pack_30: {
    headline: "30 credits. 6 videos. Go. 🎯",
    sub: "Your Creator Pack is active. That's enough to test 6 complete ad variations and find your winner.",
    highlight: "30 credits added to your account",
    bullets: [
      "6 standard videos (or 3 HD)",
      "Enough to A/B test hooks and find what converts",
      "Full AI script + scene generation",
      "MP4 downloads ready when each job completes",
    ],
  },
  pack_100: {
    headline: "100 credits. Your creative pipeline just leveled up. 🔥",
    sub: "Pro Pack loaded. That's 20 complete video ads on demand - more than most agencies produce in a month.",
    highlight: "100 credits added to your account",
    bullets: [
      "20 standard videos (or 10 HD)",
      "Full campaign worth of creative variation",
      "Test every hook angle and CTA style",
      "MP4 downloads, no watermarks, no limits",
    ],
  },
};

function fireConfetti() {
  const duration = 3000;
  const end = Date.now() + duration;

  const colors = ["#f97316", "#fb923c", "#fdba74", "#ffffff", "#fcd34d"];

  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();
}

export function PurchaseSuccessModal({ open, onClose, plan, pack }: PurchaseSuccessModalProps) {
  const firedRef = useRef(false);

  const fire = useCallback(() => {
    if (!firedRef.current) {
      firedRef.current = true;
      fireConfetti();
    }
  }, []);

  useEffect(() => {
    if (open) {
      firedRef.current = false;
      const t = setTimeout(fire, 150);
      return () => clearTimeout(t);
    }
  }, [open, fire]);

  const isPlan = plan && plan in PLANS;
  const isPack = pack && pack in CREDIT_PACKS;

  if (!isPlan && !isPack) return null;

  const planData = isPlan ? PLAN_PERKS[plan as PlanTier] : null;
  const packData = isPack ? PACK_PERKS[pack as CreditPackKey] : null;
  const data = planData ?? packData!;

  const Icon = planData ? planData.icon : Video;
  const planName = isPlan ? PLANS[plan as PlanTier].name : isPack ? CREDIT_PACKS[pack as CreditPackKey].name : "";
  const planPrice = isPlan ? `$${PLANS[plan as PlanTier].price}/mo` : isPack ? `$${CREDIT_PACKS[pack as CreditPackKey].price}` : "";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-md overflow-hidden p-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Hero band */}
        <div className="relative bg-gradient-to-br from-primary/20 via-primary/10 to-background px-6 pt-8 pb-6">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/20 ring-2 ring-primary/30">
              <Icon className="size-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                  {planName} - {planPrice}
                </Badge>
                {isPlan && (
                  <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-400/40">
                    Active
                  </Badge>
                )}
              </div>
              <h2 className="text-xl font-bold text-foreground leading-tight">
                {data.headline}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                {data.sub}
              </p>
            </div>
          </div>

          {/* Highlight bar */}
          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5">
            <p className="text-sm font-semibold text-primary text-center">
              {data.highlight}
            </p>
          </div>
        </div>

        {/* Benefits list */}
        <div className="px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            What&apos;s unlocked
          </p>
          <ul className="space-y-2.5">
            {data.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2.5">
                <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                  <Check className="size-2.5 text-emerald-400" strokeWidth={3} />
                </div>
                <span className="text-sm text-foreground leading-snug">{bullet}</span>
              </li>
            ))}
          </ul>

          {isPlan && (
            <div className="mt-4 rounded-lg bg-muted/50 px-4 py-3 flex items-center gap-3">
              <Users className="size-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                Traditional UGC creators charge $150–$500 per video. You just locked in{" "}
                <span className="font-semibold text-foreground">10–50x cheaper</span> output on autopilot.
              </p>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-2 px-6 pb-6">
          <Button asChild size="lg" className="w-full" onClick={onClose}>
            <Link href="/generate">
              <Film className="size-4" />
              Generate Your First Video →
            </Link>
          </Button>
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1"
          >
            Explore dashboard first
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
