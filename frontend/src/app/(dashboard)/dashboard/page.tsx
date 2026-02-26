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
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import type { GenerationStatus } from "@/types/database";

const mockStats = {
  videosGenerated: 12,
  creditsRemaining: 18,
  creditsTotal: 27,
  activePersonas: 1,
};

const mockRecentGenerations = [
  {
    id: "gen-1",
    productName: "Vitamin C Serum",
    personaName: "Sophie",
    date: "Feb 24, 2026",
    status: "completed" as GenerationStatus,
    videoCount: 4,
  },
  {
    id: "gen-2",
    productName: "Protein Shake",
    personaName: "Marcus",
    date: "Feb 22, 2026",
    status: "completed" as GenerationStatus,
    videoCount: 4,
  },
  {
    id: "gen-3",
    productName: "Running Shoes X1",
    personaName: "Sophie",
    date: "Feb 20, 2026",
    status: "generating_video" as GenerationStatus,
    videoCount: 2,
  },
];

const statusColors: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-400",
  generating_video: "bg-amber-500/10 text-amber-400",
  generating_image: "bg-amber-500/10 text-amber-400",
  scripting: "bg-amber-500/10 text-amber-400",
  stitching: "bg-amber-500/10 text-amber-400",
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

  const hasGenerations = mockRecentGenerations.length > 0;

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
              <p className="text-sm text-muted-foreground">Videos Generated</p>
              <p className="text-2xl font-bold text-foreground">
                {mockStats.videosGenerated}
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
                  {mockStats.creditsRemaining}/{mockStats.creditsTotal}
                </p>
              </div>
            </div>
            <Progress
              value={
                (mockStats.creditsRemaining / mockStats.creditsTotal) * 100
              }
              className="h-1.5 bg-muted [&>[data-slot=progress-indicator]]:bg-violet-500"
            />
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
                {mockStats.activePersonas}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button asChild className="bg-violet-600 hover:bg-violet-700">
          <Link href="/dashboard/generate">
            <Sparkles className="size-4" />
            New Generation
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/personas/new">
            <UserPlus className="size-4" />
            Create Persona
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/products">
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
              <Link href="/dashboard/generate">
                View all
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>

        {hasGenerations ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mockRecentGenerations.map((gen) => (
              <Link
                key={gen.id}
                href={`/dashboard/generate/${gen.id}`}
                className="group"
              >
                <Card className="transition-colors hover:border-violet-500/30">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm font-medium text-foreground">
                        {gen.productName}
                      </CardTitle>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs capitalize",
                          statusColors[gen.status]
                        )}
                      >
                        {statusLabel(gen.status)}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Persona: {gen.personaName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3" />
                        {gen.date}
                      </div>
                      <span>{gen.videoCount} videos</span>
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
                <Link href="/dashboard/generate">
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
