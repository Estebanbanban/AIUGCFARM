"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import {
  Video,
  CreditCard,
  Users,
  Film,
  UserPlus,
  Package,
  Clock,
  Loader2,
  PlayCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { formatDate } from "@/lib/utils";
import { PLANS, CREDITS_PER_SINGLE, CREDITS_PER_BATCH, CREDITS_PER_SINGLE_HD, CREDITS_PER_BATCH_HD } from "@/lib/stripe";
import { FadeInUp, StaggerContainer, staggerItem } from "@/lib/motion";
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
import { useGenerationWizardStore } from "@/stores/generation-wizard";
import { useRouter } from "next/navigation";

import { useProducts } from "@/hooks/use-products";
import { callEdge } from "@/lib/api";


interface Preset {
  id: string;
  name: string;
  config: {
    product_id: string;
    persona_id: string;
    mode: "single" | "triple";
    quality: "standard" | "hd";
    format: "9:16" | "16:9";
    cta_style: "auto" | "product_name_drop" | "link_in_bio" | "link_in_comments" | "comment_keyword" | "check_description" | "direct_website" | "discount_code";
    language: string;
    video_provider?: "kling" | "sora";
  };
  last_used_at: string | null;
  created_at: string;
}

const quickActions = [
  {
    title: "Import Products",
    description: "Add products directly from your store URL.",
    href: "/products",
    icon: Package,
  },
  {
    title: "Create AI Creator",
    description: "Set the look and voice for your AI creator.",
    href: "/personas/new",
    icon: UserPlus,
  },
  {
    title: "Generate Video",
    description: "Produce new ad variants from a single product.",
    href: "/generate",
    icon: Film,
  },
  {
    title: "View History",
    description: "Browse all your past video generations.",
    href: "/history",
    icon: Clock,
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wizard = useGenerationWizardStore();
  const { user, isLoaded, isSignedIn } = useUser();
  const firstName = user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "there";
  const [presets, setPresets] = useState<Preset[]>([]);

  const { data: credits, isLoading: creditsLoading } = useCredits();
  const { data: profile } = useProfile();
  const { data: generations, isLoading: generationsLoading } = useGenerations() as {
    data: GenerationWithRelations[] | undefined;
    isLoading: boolean;
  };
  const { data: personas, isLoading: personasLoading } = usePersonas();
  const { data: products, isLoading: productsLoading } = useProducts();

  const plan = profile?.plan ?? "free";
  const planConfig = plan !== "free" ? PLANS[plan as keyof typeof PLANS] : null;
  const creditsRemaining = credits?.remaining ?? 0;
  const isUnlimitedCredits = credits?.is_unlimited === true;
  const creditsTotal = planConfig?.credits ?? 9;

  const hasProduct = (products?.length ?? 0) > 0;

  const activeGenerations = (generations ?? []).filter(g =>
    ['locking', 'submitting_jobs', 'generating_segments'].includes(g.status)
  );
  const justCompletedGenerations = (generations ?? []).filter(g => {
    if (g.status !== 'completed') return false;
    const completedAt = new Date(g.completed_at ?? g.created_at);
    return Date.now() - completedAt.getTime() < 10 * 60 * 1000;
  });

  const draftGenerations = (generations ?? []).filter(
    (g) => g.status === "awaiting_approval",
  );
  const videosGenerated = (generations ?? []).filter(
    (g) => g.status === "completed"
  ).length;
  const activePersonas = personas?.length ?? 0;

  const hasPersonaWithImage = (personas ?? []).some(
    (p) => p.selected_image_url != null,
  );
  const hasCompletedGeneration = videosGenerated > 0;
  const allOnboardingDone = hasProduct && hasPersonaWithImage && hasCompletedGeneration;

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
      quality: gen.video_quality,
    });
    router.push("/generate");
  }

  useEffect(() => {
    const importFromQuery = searchParams.get("import");
    const pendingUrl = importFromQuery || localStorage.getItem("pendingScrapeUrl");
    if (pendingUrl) {
      localStorage.removeItem("pendingScrapeUrl");
      router.push(`/products?importUrl=${encodeURIComponent(pendingUrl)}`);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    callEdge<{ data: Preset[] }>("list-presets", { method: "GET" }).then((res) => {
      setPresets(res.data ?? []);
    }).catch(() => {});
  }, [isLoaded, isSignedIn]);

  function handleLoadPreset(preset: Preset) {
    wizard.loadPreset(preset.config);
    callEdge("update-preset-used", { body: { preset_id: preset.id } }).catch(() => {});
    router.push("/generate");
  }

  function handleDeletePreset(id: string) {
    setPresets((prev) => prev.filter((p) => p.id !== id));
    callEdge("delete-preset", { body: { preset_id: id } }).catch(() => {});
  }


  const creditPercent = isUnlimitedCredits
    ? 100
    : creditsTotal > 0
      ? Math.round((creditsRemaining / creditsTotal) * 100)
      : 0;

  // ── Loading state ─────────────────────────────────────────────────────────
  if (generationsLoading || productsLoading || personasLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── First-timer view ───────────────────────────────────────────────────────
  if (videosGenerated === 0) {
    const firstIncompleteHref = !hasProduct
      ? "/products"
      : !hasPersonaWithImage
        ? "/personas/new"
        : "/generate";

    const onboardingSteps = [
      {
        number: 1,
        title: "Import Your Products",
        description: "Add at least one product from your store URL. Takes about 2 minutes.",
        href: "/products",
        done: hasProduct,
      },
      {
        number: 2,
        title: "Create Your AI Creator",
        description: "Design the AI Creator that will star in every video you make.",
        href: "/personas/new",
        done: hasPersonaWithImage,
      },
      {
        number: 3,
        title: "Generate Your First Video",
        description: "Launch your first AI-powered UGC ad. Usually ready in under 2 minutes.",
        href: "/generate",
        done: false,
      },
    ];

    return (
      <div className="flex flex-col gap-6">
        <FadeInUp>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Welcome to CineRads, {firstName}! 👋
            </h2>
            <p className="text-sm text-muted-foreground">
              Let&apos;s create your first UGC video ad in 3 steps.
            </p>
          </div>
        </FadeInUp>

        <FadeInUp delay={0.08}>
          <div className="flex flex-col gap-3">
            {onboardingSteps.map((step) => (
              <Link key={step.number} href={step.href}>
                <Card
                  className={
                    step.done
                      ? "border-emerald-500/30 bg-emerald-500/5 transition-all hover:border-emerald-500/50"
                      : "border-border bg-card transition-all hover:border-primary/40 hover:shadow-md"
                  }
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div
                      className={
                        "flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold " +
                        (step.done
                          ? "bg-emerald-500/15 text-emerald-600"
                          : "bg-primary/10 text-primary")
                      }
                    >
                      {step.done ? (
                        <CheckCircle2 className="size-5" />
                      ) : (
                        step.number
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={
                          "text-sm font-medium " +
                          (step.done ? "text-muted-foreground line-through" : "text-foreground")
                        }
                      >
                        {step.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                    {!step.done && (
                      <Badge variant="outline" className="shrink-0 border-primary/30 text-primary">
                        Start
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </FadeInUp>

        <FadeInUp delay={0.16}>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button size="lg" asChild className="gap-2">
              <Link href={firstIncompleteHref}>
                Start Now →
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => window.dispatchEvent(new CustomEvent("onboarding:resume"))}
            >
              Open Tutorial
            </Button>
          </div>
        </FadeInUp>

        <FadeInUp delay={0.22}>
          <Card className="border-border bg-card bg-primary/5">
            <CardContent className="flex flex-col justify-between gap-3 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Credits Remaining</p>
                <CreditCard className="size-4 text-muted-foreground" />
              </div>
              <div className="size-2 rounded-full bg-primary" />
              <p className="font-mono text-3xl font-semibold text-primary">
                {creditsLoading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  isUnlimitedCredits ? "Unlimited" : creditsRemaining
                )}
              </p>
              {!creditsLoading && creditsTotal > 0 && (
                <Progress
                  value={creditPercent}
                  className="h-1.5 bg-muted [&>[data-slot=progress-indicator]]:bg-primary"
                />
              )}
            </CardContent>
          </Card>
        </FadeInUp>
      </div>
    );
  }

  // ── Returning user view ────────────────────────────────────────────────────
  return (
    <>
    <div className="flex flex-col gap-6">
      <FadeInUp>
        <Card className="border-border bg-card border-l-4 border-primary">
          <CardContent className="flex flex-col gap-5 p-6 md:flex-row md:items-end md:justify-between md:p-7">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Workspace Overview
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Welcome back, {firstName}
              </h2>
              <p className="max-w-xl text-sm text-muted-foreground">
                Track your generation pipeline, manage credits, and launch the next ad batch.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="outline" className="capitalize">
                {plan} plan
              </Badge>
            </div>
          </CardContent>
        </Card>
      </FadeInUp>

      {!allOnboardingDone && (
        <FadeInUp delay={0.05}>
          <Card className="border-border bg-card">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Get started - {[hasProduct, hasPersonaWithImage, hasCompletedGeneration].filter(Boolean).length}/3 steps complete
                </p>
                <Progress
                  value={Math.round(([hasProduct, hasPersonaWithImage, hasCompletedGeneration].filter(Boolean).length / 3) * 100)}
                  className="mt-1.5 h-1.5 bg-muted [&>[data-slot=progress-indicator]]:bg-primary"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => window.dispatchEvent(new CustomEvent("onboarding:resume"))}
              >
                Open Tutorial
              </Button>
            </CardContent>
          </Card>
        </FadeInUp>
      )}

      {activeGenerations.length > 0 && (
        <FadeInUp delay={0.04}>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                <Loader2 className="size-4 animate-spin text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {activeGenerations.length === 1
                    ? `Your video is generating...`
                    : `${activeGenerations.length} videos generating...`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {activeGenerations[0]?.products?.name && `"${activeGenerations[0].products.name}" · `}
                  Usually ready in ~75 seconds
                </p>
              </div>
              <Button size="sm" variant="outline" asChild className="shrink-0">
                <Link href={`/generate/${activeGenerations[0]?.id}`}>View progress →</Link>
              </Button>
            </CardContent>
          </Card>
        </FadeInUp>
      )}

      {justCompletedGenerations.length > 0 && activeGenerations.length === 0 && (
        <FadeInUp delay={0.04}>
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                <CheckCircle2 className="size-4 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Your video is ready!</p>
                <p className="text-xs text-muted-foreground">
                  {justCompletedGenerations[0]?.products?.name && `"${justCompletedGenerations[0].products.name}" · `}
                  Download your segments below
                </p>
              </div>
              <Button size="sm" asChild className="shrink-0">
                <Link href={`/generate/${justCompletedGenerations[0]?.id}`}>View result →</Link>
              </Button>
            </CardContent>
          </Card>
        </FadeInUp>
      )}

      <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <motion.div variants={staggerItem}>
          <Card className="border-border bg-card bg-primary/5 h-full">
            <CardContent className="flex flex-col justify-between h-full p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Videos Generated</p>
                <Video className="size-4 text-muted-foreground" />
              </div>
              <div className="size-2 rounded-full bg-primary mb-1 mt-3" />
              <p className="font-mono text-3xl font-semibold text-primary">
                {videosGenerated}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card className="border-border bg-card bg-primary/5 h-full">
            <CardContent className="flex flex-col justify-between h-full gap-3 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Credits Remaining</p>
                <CreditCard className="size-4 text-muted-foreground" />
              </div>
              <div className="size-2 rounded-full bg-primary mb-1" />
              <p className="font-mono text-3xl font-semibold text-primary">
                {creditsLoading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <>
                    {isUnlimitedCredits ? "Unlimited" : creditsRemaining}
                  </>
                )}
              </p>
              {!creditsLoading && creditsTotal > 0 && (
                <Progress
                  value={creditPercent}
                  className="h-1.5 bg-muted [&>[data-slot=progress-indicator]]:bg-primary"
                />
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card className="border-border bg-card bg-primary/5 h-full">
            <CardContent className="flex flex-col justify-between h-full p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">AI Creators</p>
                <Users className="size-4 text-muted-foreground" />
              </div>
              <div className="size-2 rounded-full bg-primary mb-1 mt-3" />
              <p className="font-mono text-3xl font-semibold text-primary">
                {activePersonas}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </StaggerContainer>

      <FadeInUp delay={0.2}>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <Link key={action.title} href={action.href} className="group">
                <div className="flex h-full flex-col gap-3 rounded-lg border border-border bg-background p-4 transition-all hover:border-primary/50 hover:bg-muted/30 hover:shadow-md">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                    <action.icon className="size-5 text-primary" />
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
      </FadeInUp>

      {presets.length > 0 && (
        <FadeInUp delay={0.25}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Your Presets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between rounded-lg border p-3 gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{preset.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {preset.config.mode === "triple" ? "Full Campaign" : "Single Ad"} ·{" "}
                        {preset.config.quality === "hd" ? "Premium" : "Budget"} ·{" "}
                        {preset.config.language.toUpperCase()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleLoadPreset(preset)}
                      >
                        Generate
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeletePreset(preset.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </FadeInUp>
      )}

      <FadeInUp delay={0.3}>
        {draftGenerations.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              Awaiting Your Approval
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {draftGenerations.map((gen) => (
                <div key={gen.id} className="ring-1 ring-amber-500/40 animate-pulse rounded-xl">
                <Card
                  className="border-amber-500/30 bg-amber-500/5 transition-all hover:border-amber-500/60 hover:shadow-md"
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
                </div>
              ))}
            </div>
          </div>
        )}

      </FadeInUp>
    </div>
    </>
  );
}
