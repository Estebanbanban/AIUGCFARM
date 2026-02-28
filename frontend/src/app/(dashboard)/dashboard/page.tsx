"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  Video,
  CreditCard,
  Users,
  Film,
  UserPlus,
  Package,
  ArrowRight,
  Clock,
  Loader2,
  DollarSign,
  PlayCircle,
  CheckCircle2,
  Circle,
  Sparkles,
} from "lucide-react";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import { PLANS, CREDITS_PER_SINGLE, CREDITS_PER_BATCH, CREDITS_PER_SINGLE_HD, CREDITS_PER_BATCH_HD } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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

// quickActions is now derived inside the component (context-aware)

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

  const recentGenerations = (generations ?? []).slice(0, 5);
  const draftGenerations = (generations ?? []).filter(
    (g) => g.status === "awaiting_approval",
  );
  const videosGenerated = (generations ?? []).filter(
    (g) => g.status === "completed"
  ).length;
  const activePersonas = personas?.length ?? 0;
  const hasGenerations = recentGenerations.length > 0;
  const isOnboarding = !generationsLoading && !hasGenerations;
  const hasProducts = confirmedProducts.length > 0;
  const hasPersonas = activePersonas > 0;

  const lastCompletedGen = (generations ?? [])
    .filter((g) => g.status === "completed")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const daysSinceLast = lastCompletedGen
    ? Math.floor((Date.now() - new Date(lastCompletedGen.created_at).getTime()) / 86400000)
    : 999;

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
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col gap-5 p-6 md:flex-row md:items-end md:justify-between md:p-7">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Workspace Overview
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {isOnboarding ? "Welcome to AIUGC" : `Welcome back, ${firstName}`}
            </h2>
            <p className="max-w-xl text-sm text-muted-foreground">
              {isOnboarding
                ? "Create AI-powered UGC video ads in minutes. Let's get started."
                : "Track your generation pipeline, manage credits, and launch the next ad batch."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="capitalize">
              {plan} plan
            </Badge>
            <Button asChild size="sm">
              <Link href="/generate">
                New Generation
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding path for new users */}
      {isOnboarding && (
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardContent className="p-6">
            <h3 className="mb-4 text-base font-semibold text-foreground">
              3 steps to your first UGC video
            </h3>
            <div className="flex flex-col gap-3">
              {[
                {
                  step: 1,
                  label: "Import your product",
                  done: hasProducts,
                  active: !hasProducts,
                  href: "/products",
                  cta: "Import Product",
                },
                {
                  step: 2,
                  label: "Create an AI persona",
                  done: hasPersonas,
                  active: hasProducts && !hasPersonas,
                  href: "/personas/new",
                  cta: "Create Persona",
                },
                {
                  step: 3,
                  label: "Generate your video",
                  done: false,
                  active: hasProducts && hasPersonas,
                  href: "/generate",
                  cta: "Generate Video",
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
                      <CheckCircle2 className="size-5 text-emerald-500" />
                    ) : (
                      <Circle
                        className={cn(
                          "size-5",
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Videos Generated</p>
              <Video className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-3 font-mono text-3xl font-semibold text-foreground">
              {generationsLoading ? <Loader2 className="size-5 animate-spin" /> : videosGenerated}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Credits Remaining</p>
              <CreditCard className="size-4 text-muted-foreground" />
            </div>
            <p className="font-mono text-3xl font-semibold text-foreground">
              {creditsLoading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <>
                  {isUnlimitedCredits ? (
                    "Unlimited"
                  ) : creditsTotal > 0 ? (
                    <>
                      {creditsRemaining}
                      <span className="text-lg text-muted-foreground">/{creditsTotal}</span>
                    </>
                  ) : (
                    creditsRemaining
                  )}
                </>
              )}
            </p>
            {!creditsLoading && creditsTotal > 0 && (
              <Progress
                value={creditPercent}
                className="h-1.5 bg-muted [&>[data-slot=progress-indicator]]:bg-primary"
              />
            )}
            {!creditsLoading && creditsRemaining === 0 && !isUnlimitedCredits && (
              <Button asChild variant="outline" size="sm" className="mt-1 w-full">
                <Link href="/pricing">
                  <Sparkles className="size-3.5" />
                  Upgrade to start generating
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Active Personas</p>
              <Users className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-3 font-mono text-3xl font-semibold text-foreground">
              {activePersonas}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Re-engagement widget — only for returning users who haven't generated recently */}
      {hasGenerations && lastCompletedGen && daysSinceLast >= 3 && (
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Ready to run another batch?
                </p>
                <p className="text-xs text-muted-foreground">
                  Last generation: {lastCompletedGen.products?.name ?? "Untitled"} · {formatDate(lastCompletedGen.created_at)}
                </p>
              </div>
            </div>
            <Button asChild size="sm" className="shrink-0">
              <Link href="/generate">
                <Film className="size-4" />
                Generate Again
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions — context-aware ordering */}
      {(() => {
        const actions = [
          {
            title: "Generate Video",
            description: "Produce new ad variants from a single product.",
            href: "/generate",
            icon: Film,
            highlight: hasProducts && hasPersonas,
            disabled: !hasProducts || !hasPersonas,
          },
          {
            title: "Create Persona",
            description: "Set the look and voice for your AI creator.",
            href: "/personas/new",
            icon: UserPlus,
            highlight: hasProducts && !hasPersonas,
            disabled: false,
          },
          {
            title: "Import Products",
            description: "Add products directly from your store URL.",
            href: "/products",
            icon: Package,
            highlight: !hasProducts,
            disabled: false,
          },
        ].sort((a, b) => (b.highlight ? 1 : 0) - (a.highlight ? 1 : 0));

        return (
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {actions.map((action) => (
                <Link
                  key={action.title}
                  href={action.disabled ? "#" : action.href}
                  className={cn("group", action.disabled && "pointer-events-none opacity-50")}
                  aria-disabled={action.disabled}
                >
                  <div
                    className={cn(
                      "flex h-full flex-col gap-3 rounded-lg border bg-background p-4 transition-colors",
                      action.highlight
                        ? "border-primary/40 bg-primary/5 hover:border-primary/60"
                        : "border-border hover:border-primary/40 hover:bg-muted/30",
                    )}
                  >
                    <div className="flex size-9 items-center justify-center rounded-md bg-primary/10">
                      <action.icon className="size-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{action.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        );
      })()}

      {draftGenerations.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Script Ready — Awaiting Approval
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {draftGenerations.map((gen) => (
              <Card
                key={gen.id}
                className="border-amber-500/30 bg-amber-500/5 transition-colors hover:border-amber-500/60"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-1 text-sm font-medium">
                      {gen.products?.name ?? `Generation ${gen.id.slice(0, 8)}`}
                    </CardTitle>
                    <Badge
                      variant="secondary"
                      className="shrink-0 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300"
                    >
                      Draft
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {formatDate(gen.created_at)}
                  </div>
                </CardHeader>
                <CardContent className="pb-4 pt-0">
                  <Button
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => handleResumeDraft(gen)}
                  >
                    <PlayCircle className="size-3.5" />
                    Review &amp; Generate
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {(hasGenerations || generationsLoading) && (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Recent Generations</h2>
          {hasGenerations && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/history">
                View all
                <ArrowRight className="size-4" />
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
        ) : hasGenerations ? (
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
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="line-clamp-1 text-sm font-medium">
                          {gen.products?.name ?? `Generation ${gen.id.slice(0, 8)}`}
                        </CardTitle>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "shrink-0 text-xs capitalize",
                            statusColors[gen.status] ?? statusColors.pending
                          )}
                        >
                          {statusLabel(gen.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {formatDate(gen.created_at)}
                      </div>
                      {showCost && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <DollarSign className="size-3" />
                          {formatCurrency(cost.totalCostUsd)} · {cost.modelName}
                        </div>
                      )}
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
      )}
    </div>
    </>
  );
}
