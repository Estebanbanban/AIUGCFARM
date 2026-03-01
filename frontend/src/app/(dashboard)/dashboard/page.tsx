"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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
import { Suspense } from "react";
import { CheckoutSuccessHandler } from "@/components/checkout/CheckoutSuccessHandler";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";


const quickActions = [
  {
    title: "Import Products",
    description: "Add products directly from your store URL.",
    href: "/products",
    icon: Package,
  },
  {
    title: "Create Persona",
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
  const wizard = useGenerationWizardStore();
  const [firstName, setFirstName] = useState("there");

  const { data: credits, isLoading: creditsLoading } = useCredits();
  const { data: profile } = useProfile();
  const { data: generations, isLoading: generationsLoading } = useGenerations() as {
    data: GenerationWithRelations[] | undefined;
    isLoading: boolean;
  };
  const { data: personas } = usePersonas();

  const plan = profile?.plan ?? "free";
  const planConfig = plan !== "free" ? PLANS[plan as keyof typeof PLANS] : null;
  const creditsRemaining = credits?.remaining ?? 0;
  const isUnlimitedCredits = credits?.is_unlimited === true;
  const creditsTotal = planConfig?.credits ?? 9;

  const [hasProduct, setHasProduct] = useState(false);

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
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.full_name) {
        setFirstName(user.user_metadata.full_name.split(" ")[0]);
      } else if (user?.email) {
        setFirstName(user.email.split("@")[0]);
      }
    });
    supabase
      .from("products")
      .select("id")
      .eq("status", "confirmed")
      .limit(1)
      .then(({ data }) => {
        setHasProduct((data ?? []).length > 0);
      });
  }, []);

  const creditPercent = isUnlimitedCredits
    ? 100
    : creditsTotal > 0
      ? Math.round((creditsRemaining / creditsTotal) * 100)
      : 0;

  return (
    <>
    <Suspense>
      <CheckoutSuccessHandler />
    </Suspense>
    <div className="flex flex-col gap-6">
      <FadeInUp>
        <Card className="border-border bg-card">
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
          <OnboardingChecklist
            hasProduct={hasProduct}
            hasPersonaWithImage={hasPersonaWithImage}
            hasCompletedGeneration={hasCompletedGeneration}
          />
        </FadeInUp>
      )}

      <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <motion.div variants={staggerItem}>
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Videos Generated</p>
                <Video className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-3 font-mono text-3xl font-semibold text-primary">
                {generationsLoading ? <Loader2 className="size-5 animate-spin" /> : videosGenerated}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Credits Remaining</p>
                <CreditCard className="size-4 text-muted-foreground" />
              </div>
              <p className="font-mono text-3xl font-semibold text-primary">
                {creditsLoading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <>
                    {isUnlimitedCredits ? (
                      "Unlimited"
                    ) : (
                      <>
                        {creditsRemaining}
                        <span className="text-lg text-muted-foreground">/{creditsTotal}</span>
                      </>
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
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Active Personas</p>
                <Users className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-3 font-mono text-3xl font-semibold text-primary">
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
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <Link key={action.title} href={action.href} className="group">
                <div className="flex h-full flex-col gap-3 rounded-lg border border-border bg-background p-4 transition-all hover:border-primary/50 hover:bg-muted/30 hover:shadow-md">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5">
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

      <FadeInUp delay={0.3}>
        {draftGenerations.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              Awaiting Your Approval
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {draftGenerations.map((gen) => (
                <Card
                  key={gen.id}
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
              ))}
            </div>
          </div>
        )}

      </FadeInUp>
    </div>
    </>
  );
}
