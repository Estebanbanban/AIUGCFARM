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
  ArrowRight,
  Clock,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANS } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/utils";
import { useCredits } from "@/hooks/use-credits";
import { useProfile } from "@/hooks/use-profile";
import {
  useGenerations,
  type GenerationWithRelations,
} from "@/hooks/use-generations";
import { usePersonas } from "@/hooks/use-personas";
import type { GenerationStatus } from "@/types/database";

const statusColors: Record<GenerationStatus, string> = {
  pending: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
  scripting: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  submitting_jobs: "bg-primary/10 text-primary",
  generating_segments: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  failed: "bg-red-500/10 text-red-700 dark:text-red-300",
};

function statusLabel(status: GenerationStatus): string {
  if (status === "completed" || status === "failed") return status;
  return "In Progress";
}

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
];

export default function DashboardPage() {
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
  const creditsTotal = planConfig?.credits ?? 9;

  const recentGenerations = (generations ?? []).slice(0, 5);
  const videosGenerated = (generations ?? []).filter(
    (g) => g.status === "completed"
  ).length;
  const activePersonas = personas?.length ?? 0;
  const hasGenerations = recentGenerations.length > 0;

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

  const creditPercent =
    creditsTotal > 0 ? Math.round((creditsRemaining / creditsTotal) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
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
            <Button asChild size="sm">
              <Link href="/generate">
                New Generation
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

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
                  {creditsRemaining}
                  <span className="text-lg text-muted-foreground">/{creditsTotal}</span>
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

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {quickActions.map((action) => (
            <Link key={action.title} href={action.href} className="group">
              <div className="flex h-full flex-col gap-3 rounded-lg border border-border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-muted/30">
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
            {recentGenerations.map((gen) => (
              <Link key={gen.id} href={`/generate/${gen.id}`} className="group">
                <Card className="h-full border-border bg-card transition-colors hover:border-primary/40">
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
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                <Film className="size-7 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-foreground">Create your first video ad</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Import a product, build a persona, and generate ad-ready variants in minutes.
                </p>
              </div>
              <Button asChild>
                <Link href="/generate">
                  <Film className="size-4" />
                  Get Started
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
