"use client";

export const dynamic = "force-dynamic";

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  X,
  Loader2,
  Play,
  Download,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import type {
  GenerationStatus,
  GenerationScript,
  GenerationVideo,
} from "@/types/database";

const mockGeneration = {
  id: "gen-new-1",
  productName: "Vitamin C Serum",
  personaName: "Sophie",
  mode: "easy" as const,
  status: "generating_video" as GenerationStatus,
  script: {
    hook: {
      text: "Ever wondered why your skin looks dull in the morning?",
      duration: 5,
    },
    body: {
      text: "This Vitamin C Serum has 20% L-Ascorbic Acid that really brightens your skin tone...",
      duration: 15,
    },
    cta: {
      text: "Click the link below to get 20% off your first order!",
      duration: 5,
    },
  } as GenerationScript,
  videos: [
    {
      url: "",
      thumbnail_url: "",
      duration: 25,
      variation_index: 0,
    },
    {
      url: "",
      thumbnail_url: "",
      duration: 25,
      variation_index: 1,
    },
  ] as GenerationVideo[],
  error_message: null as string | null,
};

const statusConfig: Record<
  GenerationStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Pending",
    color: "text-zinc-400",
    icon: <Clock className="size-4 text-zinc-400" />,
  },
  scripting: {
    label: "Writing script",
    color: "text-amber-400",
    icon: <Loader2 className="size-4 animate-spin text-amber-400" />,
  },
  generating_image: {
    label: "Generating image",
    color: "text-blue-400",
    icon: <Loader2 className="size-4 animate-spin text-blue-400" />,
  },
  generating_video: {
    label: "Generating videos",
    color: "text-blue-400",
    icon: <Loader2 className="size-4 animate-spin text-blue-400" />,
  },
  stitching: {
    label: "Stitching videos",
    color: "text-blue-400",
    icon: <Loader2 className="size-4 animate-spin text-blue-400" />,
  },
  completed: {
    label: "Completed",
    color: "text-emerald-400",
    icon: <Check className="size-4 text-emerald-400" />,
  },
  failed: {
    label: "Failed",
    color: "text-red-400",
    icon: <X className="size-4 text-red-400" />,
  },
};

export default function GenerationProgressPage() {
  const params = useParams();
  const generationId = params.id as string;

  const gen = mockGeneration;
  const config = statusConfig[gen.status];
  const isComplete = gen.status === "completed";
  const isFailed = gen.status === "failed";
  const isProcessing = !isComplete && !isFailed;

  const totalVariations = 4;
  const completedVariations = gen.videos.length;
  const progressPercent = isComplete
    ? 100
    : Math.round((completedVariations / totalVariations) * 100);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/dashboard/generate">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Generation Progress
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {gen.productName} / {gen.personaName}
          </p>
        </div>
        {isProcessing && (
          <Badge
            variant="secondary"
            className="bg-amber-500/10 text-amber-400"
          >
            <Loader2 className="size-3 animate-spin" />
            {config.label}
          </Badge>
        )}
        {isComplete && (
          <Badge
            variant="secondary"
            className="bg-emerald-500/10 text-emerald-400"
          >
            <Check className="size-3" />
            Complete
          </Badge>
        )}
        {isFailed && (
          <Badge variant="secondary" className="bg-red-500/10 text-red-400">
            <X className="size-3" />
            Failed
          </Badge>
        )}
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium text-foreground">
              {completedVariations}/{totalVariations} video variations
            </span>
          </div>
          <Progress
            value={progressPercent}
            className="h-2 bg-muted [&>[data-slot=progress-indicator]]:bg-violet-500"
          />
        </CardContent>
      </Card>

      {/* Script Preview */}
      {gen.script && (
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Generated Script</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-lg border border-border px-4 py-3">
              <Badge variant="outline" className="mb-2 text-xs">
                Hook ({gen.script.hook.duration}s)
              </Badge>
              <p className="text-sm text-foreground">{gen.script.hook.text}</p>
            </div>
            <div className="rounded-lg border border-border px-4 py-3">
              <Badge variant="outline" className="mb-2 text-xs">
                Body ({gen.script.body.duration}s)
              </Badge>
              <p className="text-sm text-foreground">{gen.script.body.text}</p>
            </div>
            <div className="rounded-lg border border-border px-4 py-3">
              <Badge variant="outline" className="mb-2 text-xs">
                CTA ({gen.script.cta.duration}s)
              </Badge>
              <p className="text-sm text-foreground">{gen.script.cta.text}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {gen.error_message && (
        <Card className="border-red-500/30">
          <CardContent className="flex items-center gap-3">
            <AlertCircle className="size-5 text-red-400" />
            <p className="text-sm text-red-400">{gen.error_message}</p>
          </CardContent>
        </Card>
      )}

      {/* Video Variations */}
      {gen.videos.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Video Variations
                </h2>
                <p className="text-sm text-muted-foreground">
                  {completedVariations} of {totalVariations} variations ready
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {gen.videos.map((video) => (
                <Card key={video.variation_index}>
                  <CardContent className="flex flex-col gap-3">
                    <div className="relative flex aspect-video items-center justify-center rounded-lg bg-muted">
                      <Play className="size-8 text-muted-foreground" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        Variation {video.variation_index + 1}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {video.duration}s
                      </span>
                    </div>
                    <Button variant="outline" size="sm" disabled={!video.url}>
                      <Download className="size-4" />
                      Download MP4
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
