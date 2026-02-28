"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  CreditCard,
  Clock,
  DollarSign,
  PlayCircle,
  CheckCircle2,
  Circle,
  ArrowRight,
  Film,
} from "lucide-react";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import { PLANS, CREDITS_PER_SINGLE, CREDITS_PER_BATCH, CREDITS_PER_SINGLE_HD, CREDITS_PER_BATCH_HD } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useCredits } from "@/hooks/use-credits";
import { useProfile } from "@/hooks/use-profile";
import {
  useGenerations,
  type GenerationWithRelations,
} from "@/hooks/use-generations";
import { usePersonas } from "@/hooks/use-personas";
import { useProducts } from "@/hooks/use-products";
import type { GenerationStatus } from "@/types/database";
import { useGenerationWizardStore } from "@/stores/generation-wizard";
import { useRouter } from "next/navigation";
import { calculateGenerationCost } from "@/lib/generation-cost";
import { Suspense } from "react";
import { CheckoutSuccessHandler } from "@/components/checkout/CheckoutSuccessHandler";

const statusColors: Record<GenerationStatus, string> = {
  pending: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
  scripting: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  awaiting_approval: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  locking: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  submitting_jobs: "bg-primary/10 text-primary",
  generating_segments: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  failed: "bg-red-500/10 text-red-700 dark:text-red-300",
};

function statusLabel(status: GenerationStatus): string {
  if (status === "completed" || status === "failed") return status;
  return "In Progress";
}

export default function DashboardPage() {
  const router = useRouter();
  const wizard = useGenerationWizardStore();
  const [firstName, setFirstName] = useState("there");

  const { data: credits, isLoading: creditsLoading } = useCredits();
  const { data: profile } = useProfile();
  const { data: generations, isLoading: generationsLoading } = useGenerations() as {
    data: GenerationWithRelations[] | undefined;
    isLoading: boolean;
  };
  const { data: personas } = usePersonas();
  const { data: products } = useProducts();

  const confirmedProducts = products?.filter((p) => p.confirmed) ?? [];
  const plan = profile?.plan ?? "free";
  const planConfig = plan !== "free" ? PLANS[plan as keyof typeof PLANS] : null;
  const creditsRemaining = credits?.remaining ?? 0;
  const isUnlimitedCredits = credits?.is_unlimited === true;
  const creditsTotal = planConfig?.credits ?? 0;

  const recentGenerations = (generations ?? []).slice(0, 6);
  const draftGenerations = (generations ?? []).filter(
    (g) => g.status === "awaiting_approval",
  );
  const hasGenerations = recentGenerations.length > 0;
  const isOnboarding = !generationsLoading && !hasGenerations;
  const hasProducts = confirmedProducts.length > 0;
  const hasPersonas = (personas?.length ?? 0) > 0;

  function handleResumeDraft(gen: GenerationWithRelations) {
    if (!gen.script) {
      router.push("/generate");
      return;
    }
    const creditsToCharge =
      gen.video_quality === "hd"
        ? gen.mode === "single" ? CREDITS_PER_SINGLE_HD : CREDITS_PER_BATCH_HD
        : gen.mode === "single" ? CREDITS_PER_SINGLE : CREDITS_PER_BATCH;
    wizard.resumeFromGeneration({
      generationId: gen.id,
      script: gen.script,
      creditsToCharge,
      productId: gen.product_id,
      personaId: gen.persona_id,
      mode: gen.mode,
      quality: gen.video_quality as "standard" | "hd",
    });
    router.push("/generate");
  }

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.full_name) {
        setFirstName(user.user_metadata.full_name.split(" ")[0]);
      } else if (user?.email) {
        setFirstName(user.email.split("@")[0]);
      }
    });
  }, []);

  const creditPercent = isUnlimitedCredits
    ? 100
    : creditsTotal > 0
      ? Math.min(100, Math.round((creditsRemaining / creditsTotal) * 100))
      : 0;

  return (
    <>
      <Suspense>
        <CheckoutSuccessHandler />
      </Suspense>
      <div className="flex flex-col gap-6">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {isOnboarding ? "Get started" : `Welcome back, ${firstName}`}
            </h1>
            {isOnboarding && (
              <p className="mt-1 text-sm text-muted-foreground">
                Complete these steps to generate your first video ad.
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Credits pill — always visible */}
            {!creditsLoading && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                <CreditCard className="size-3.5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {isUnlimitedCredits ? "Unlimited" : creditsRemaining}
                  {!isUnlimitedCredits && creditsTotal > 0 && (
                    <span className="text-muted-foreground">/{creditsTotal}</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">credits</span>
                {!isUnlimitedCredits && creditsRemaining === 0 && (
                  <Link
                    href="/pricing"
                    className="ml-1 text-xs font-semibold text-primary hover:underline"
                  >
                    Top up →
                  </Link>
                )}
              </div>
            )}
            <Button asChild>
              <Link href="/generate">
                <Film className="size-4" />
                New Generation
              </Link>
            </Button>
          </div>
        </div>

        {/* ── Credit progress bar (only if on a plan) ─────────────────── */}
        {!creditsLoading && !isUnlimitedCredits && creditsTotal > 0 && (
          <div className="flex items-center gap-3">
            <Progress
              value={creditPercent}
              className="h-1.5 flex-1 bg-muted [&>[data-slot=progress-indicator]]:bg-primary"
            />
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {creditsRemaining} / {creditsTotal} credits
            </span>
          </div>
        )}

        {/* ── Onboarding checklist (new users only) ───────────────────── */}
        {isOnboarding && (
          <Card className="border-primary/20 bg-primary/[0.02]">
            <CardContent className="p-5">
              <div className="flex flex-col gap-2.5">
                {[
                  {
                    step: 1,
                    label: "Import your product",
                    done: hasProducts,
                    active: !hasProducts,
                    href: "/products",
                    cta: "Import",
                  },
                  {
                    step: 2,
                    label: "Create an AI persona",
                    done: hasPersonas,
                    active: hasProducts && !hasPersonas,
                    href: "/personas/new",
                    cta: "Create",
                  },
                  {
                    step: 3,
                    label: "Generate your first video",
                    done: false,
                    active: hasProducts && hasPersonas,
                    href: "/generate",
                    cta: "Generate",
                  },
                ].map((s) => (
                  <div
                    key={s.step}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-4 py-3 transition-colors",
                      s.active
                        ? "border-primary/40 bg-primary/5"
                        : s.done
                          ? "border-border bg-background opacity-60"
                          : "border-border bg-background",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {s.done ? (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      ) : (
                        <Circle
                          className={cn(
                            "size-4",
                            s.active ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                      )}
                      <span
                        className={cn(
                          "text-sm font-medium",
                          s.done
                            ? "text-muted-foreground line-through"
                            : s.active
                              ? "text-foreground"
                              : "text-muted-foreground",
                        )}
                      >
                        {s.step}. {s.label}
                      </span>
                    </div>
                    {!s.done && (
                      <Button
                        asChild
                        size="sm"
                        variant={s.active ? "default" : "ghost"}
                      >
                        <Link href={s.href}>
                          {s.cta}
                          {s.active && <ArrowRight className="size-3.5" />}
                        </Link>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Drafts — script ready, user needs to approve & generate ─── */}
        {draftGenerations.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Continue
              </h2>
              <span className="text-xs text-muted-foreground">
                {draftGenerations.length} script{draftGenerations.length !== 1 ? "s" : ""} waiting
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {draftGenerations.map((gen) => (
                <Card
                  key={gen.id}
                  className="border-amber-500/30 bg-amber-500/5 transition-colors hover:border-amber-500/60"
                >
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {gen.products?.name ?? `Generation ${gen.id.slice(0, 8)}`}
                      </p>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {formatDate(gen.created_at)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0"
                      onClick={() => handleResumeDraft(gen)}
                    >
                      <PlayCircle className="size-3.5" />
                      Continue
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ── Recent generations ───────────────────────────────────────── */}
        {(hasGenerations || generationsLoading) && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Recent
              </h2>
              {hasGenerations && (
                <Button asChild variant="ghost" size="sm" className="h-auto py-0 text-xs">
                  <Link href="/history">
                    View all
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              )}
            </div>

            {generationsLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="h-32 animate-pulse bg-muted" />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recentGenerations.map((gen) => {
                  const cost = calculateGenerationCost(
                    gen.videos,
                    gen.video_quality,
                    gen.kling_model,
                  );
                  const showCost = gen.status === "completed" && cost.totalBilledSeconds > 0;
                  const thumbSrc = gen.composite_image_url ?? null;
                  return (
                    <Link key={gen.id} href={`/generate/${gen.id}`} className="group">
                      <Card className="h-full overflow-hidden border-border bg-card transition-colors hover:border-primary/40">
                        {thumbSrc ? (
                          <div className="relative h-36 w-full overflow-hidden bg-muted">
                            <Image
                              src={thumbSrc}
                              alt={gen.products?.name ?? "Generation preview"}
                              fill
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            />
                          </div>
                        ) : (
                          <div className="h-36 w-full bg-gradient-to-br from-primary/10 via-primary/5 to-muted" />
                        )}
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <p className="line-clamp-1 text-sm font-medium text-foreground">
                              {gen.products?.name ?? `Generation ${gen.id.slice(0, 8)}`}
                            </p>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "shrink-0 text-xs capitalize",
                                statusColors[gen.status] ?? statusColors.pending,
                              )}
                            >
                              {statusLabel(gen.status)}
                            </Badge>
                          </div>
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="size-3" />
                            {formatDate(gen.created_at)}
                            {showCost && (
                              <>
                                <span>·</span>
                                <DollarSign className="size-3" />
                                {formatCurrency(cost.totalCostUsd)}
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
