"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Video,
  CreditCard,
  Users,
  Sparkles,
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
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/utils";
import { useCredits } from "@/hooks/use-credits";
import { useProfile } from "@/hooks/use-profile";
import { useGenerations, type GenerationWithRelations } from "@/hooks/use-generations";
import { usePersonas } from "@/hooks/use-personas";
import type { GenerationStatus } from "@/types/database";

const statusColors: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-400",
  submitting_jobs: "bg-violet-500/10 text-violet-400",
  generating_segments: "bg-blue-500/10 text-blue-400",
  generating_image: "bg-amber-500/10 text-amber-400",
  scripting: "bg-amber-500/10 text-amber-400",
  failed: "bg-red-500/10 text-red-400",
  pending: "bg-zinc-500/10 text-zinc-400",
};

function statusLabel(status: GenerationStatus): string {
  if (status === "completed" || status === "failed" || status === "pending")
    return status;
  return "In Progress";
}

export default function DashboardPage() {
  const [firstName, setFirstName] = useState("there");

  const { data: credits, isLoading: creditsLoading } = useCredits();
  const { data: profile } = useProfile();
  const { data: generations, isLoading: generationsLoading } = useGenerations() as { data: GenerationWithRelations[] | undefined; isLoading: boolean };
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

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here is an overview of your AI UGC workspace.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10">
              <Video className="size-5 text-violet-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Generations</p>
              <p className="text-2xl font-bold text-foreground">
                {generationsLoading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  videosGenerated
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10">
                <CreditCard className="size-5 text-violet-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Credits Remaining
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {creditsLoading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    `${creditsRemaining}/${creditsTotal}`
                  )}
                </p>
              </div>
            </div>
            {!creditsLoading && creditsTotal > 0 && (
              <Progress
                value={(creditsRemaining / creditsTotal) * 100}
                className="h-1.5 bg-muted [&>[data-slot=progress-indicator]]:bg-violet-500"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10">
              <Users className="size-5 text-violet-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Personas</p>
              <p className="text-2xl font-bold text-foreground">
                {activePersonas}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button asChild className="bg-violet-600 hover:bg-violet-700">
          <Link href="/generate">
            <Sparkles className="size-4" />
            New Generation
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/personas/new">
            <UserPlus className="size-4" />
            Create Persona
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/products">
            <Package className="size-4" />
            Import Products
          </Link>
        </Button>
      </div>

      {/* Recent Generations */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Recent Generations
          </h2>
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
              <Link
                key={gen.id}
                href={`/generate/${gen.id}`}
                className="group"
              >
                <Card className="transition-colors hover:border-violet-500/30">
                  <CardContent className="flex flex-col gap-2 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {gen.products?.name ?? `Generation ${gen.id.slice(0, 8)}`}
                        </p>
                        {gen.personas?.name && (
                          <p className="truncate text-xs text-muted-foreground">
                            {gen.personas.name}
                          </p>
                        )}
                      </div>
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
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <div className="flex size-14 items-center justify-center rounded-full bg-violet-500/10">
                <Sparkles className="size-7 text-violet-500" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-foreground">
                  Create your first AI UGC video
                </h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Import a product, build a persona, and generate
                  scroll-stopping video ads in minutes.
                </p>
              </div>
              <Button asChild className="bg-violet-600 hover:bg-violet-700">
                <Link href="/generate">
                  <Sparkles className="size-4" />
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
