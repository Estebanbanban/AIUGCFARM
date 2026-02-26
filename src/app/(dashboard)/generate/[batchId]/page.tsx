"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  X,
  Loader2,
  Play,
  Download,
  Eye,
  AlertCircle,
  Clock,
  Sparkles,
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
import { Separator } from "@/components/ui/separator";
import type { SegmentStatus, SegmentType } from "@/types/database";

interface MockSegment {
  id: string;
  type: SegmentType;
  status: SegmentStatus;
  script_text: string | null;
  error_message: string | null;
}

const mockBatch = {
  id: "batch-new-1",
  productName: "Vitamin C Serum",
  personaName: "Sophie",
  total_segments: 9,
  completed_segments: 5,
  status: "processing",
};

const mockSegments: MockSegment[] = [
  {
    id: "seg-1",
    type: "hook",
    status: "completed",
    script_text: "Ever wondered why your skin looks dull in the morning?",
    error_message: null,
  },
  {
    id: "seg-2",
    type: "hook",
    status: "completed",
    script_text: "I found the ONE product that changed everything...",
    error_message: null,
  },
  {
    id: "seg-3",
    type: "hook",
    status: "generating_video",
    script_text: "Stop scrolling! This serum is a game-changer.",
    error_message: null,
  },
  {
    id: "seg-4",
    type: "body",
    status: "completed",
    script_text:
      "This Vitamin C Serum has 20% L-Ascorbic Acid that really brightens your skin tone...",
    error_message: null,
  },
  {
    id: "seg-5",
    type: "body",
    status: "completed",
    script_text: "I have been using it for 2 weeks and the difference is incredible...",
    error_message: null,
  },
  {
    id: "seg-6",
    type: "body",
    status: "generating_script",
    script_text: null,
    error_message: null,
  },
  {
    id: "seg-7",
    type: "cta",
    status: "completed",
    script_text: "Click the link below to get 20% off your first order!",
    error_message: null,
  },
  {
    id: "seg-8",
    type: "cta",
    status: "pending",
    script_text: null,
    error_message: null,
  },
  {
    id: "seg-9",
    type: "cta",
    status: "failed",
    script_text: null,
    error_message: "Video generation timed out. Please retry.",
  },
];

const statusConfig: Record<
  SegmentStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Pending",
    color: "text-zinc-400",
    icon: <Clock className="size-4 text-zinc-400" />,
  },
  generating_script: {
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
    label: "Generating video",
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

export default function BatchProgressPage() {
  const params = useParams();
  const batchId = params.batchId as string;

  const [selectedHook, setSelectedHook] = useState<string | null>(null);
  const [selectedBody, setSelectedBody] = useState<string | null>(null);
  const [selectedCta, setSelectedCta] = useState<string | null>(null);

  const hooks = mockSegments.filter((s) => s.type === "hook");
  const bodies = mockSegments.filter((s) => s.type === "body");
  const ctas = mockSegments.filter((s) => s.type === "cta");

  const completedCount = mockSegments.filter(
    (s) => s.status === "completed"
  ).length;
  const totalCount = mockSegments.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const allDone = mockSegments.every(
    (s) => s.status === "completed" || s.status === "failed"
  );
  const hasCompletedSegments = completedCount > 0;

  const canPreview = selectedHook && selectedBody && selectedCta;

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
            {mockBatch.productName} / {mockBatch.personaName}
          </p>
        </div>
        {!allDone && (
          <Badge
            variant="secondary"
            className="bg-amber-500/10 text-amber-400"
          >
            <Loader2 className="size-3 animate-spin" />
            Processing
          </Badge>
        )}
        {allDone && (
          <Badge
            variant="secondary"
            className="bg-emerald-500/10 text-emerald-400"
          >
            <Check className="size-3" />
            Complete
          </Badge>
        )}
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium text-foreground">
              {completedCount}/{totalCount} segments completed
            </span>
          </div>
          <Progress
            value={progressPercent}
            className="h-2 bg-muted [&>[data-slot=progress-indicator]]:bg-violet-500"
          />
        </CardContent>
      </Card>

      {/* Segment Status List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Segments</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {mockSegments.map((segment) => {
            const config = statusConfig[segment.status];
            return (
              <div
                key={segment.id}
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-3"
              >
                {config.icon}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {segment.type}
                    </Badge>
                    <span className={cn("text-xs font-medium", config.color)}>
                      {config.label}
                    </span>
                  </div>
                  {segment.script_text && (
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {segment.script_text}
                    </p>
                  )}
                  {segment.error_message && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                      <AlertCircle className="size-3" />
                      {segment.error_message}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Mixer Section */}
      {hasCompletedSegments && (
        <>
          <Separator />
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Video Mixer
                </h2>
                <p className="text-sm text-muted-foreground">
                  Select one segment from each column to create a combo.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canPreview}
                >
                  <Eye className="size-4" />
                  Preview Combo
                </Button>
                <Button
                  size="sm"
                  disabled={!canPreview}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  <Download className="size-4" />
                  Download MP4
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {/* Hooks Column */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Hooks ({hooks.filter((h) => h.status === "completed").length})
                </h3>
                {hooks
                  .filter((h) => h.status === "completed")
                  .map((segment) => (
                    <button
                      key={segment.id}
                      onClick={() => setSelectedHook(segment.id)}
                      className="text-left"
                    >
                      <Card
                        className={cn(
                          "transition-all",
                          selectedHook === segment.id
                            ? "border-violet-500 ring-1 ring-violet-500/30"
                            : "hover:border-muted-foreground/30"
                        )}
                      >
                        <CardContent className="flex flex-col gap-2">
                          <div className="relative flex aspect-video items-center justify-center rounded-lg bg-muted">
                            <Play className="size-8 text-muted-foreground" />
                            {selectedHook === segment.id && (
                              <div className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-violet-500">
                                <Check className="size-3 text-white" />
                              </div>
                            )}
                          </div>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {segment.script_text}
                          </p>
                        </CardContent>
                      </Card>
                    </button>
                  ))}
              </div>

              {/* Bodies Column */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Bodies (
                  {bodies.filter((b) => b.status === "completed").length})
                </h3>
                {bodies
                  .filter((b) => b.status === "completed")
                  .map((segment) => (
                    <button
                      key={segment.id}
                      onClick={() => setSelectedBody(segment.id)}
                      className="text-left"
                    >
                      <Card
                        className={cn(
                          "transition-all",
                          selectedBody === segment.id
                            ? "border-violet-500 ring-1 ring-violet-500/30"
                            : "hover:border-muted-foreground/30"
                        )}
                      >
                        <CardContent className="flex flex-col gap-2">
                          <div className="relative flex aspect-video items-center justify-center rounded-lg bg-muted">
                            <Play className="size-8 text-muted-foreground" />
                            {selectedBody === segment.id && (
                              <div className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-violet-500">
                                <Check className="size-3 text-white" />
                              </div>
                            )}
                          </div>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {segment.script_text}
                          </p>
                        </CardContent>
                      </Card>
                    </button>
                  ))}
              </div>

              {/* CTAs Column */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">
                  CTAs ({ctas.filter((c) => c.status === "completed").length})
                </h3>
                {ctas
                  .filter((c) => c.status === "completed")
                  .map((segment) => (
                    <button
                      key={segment.id}
                      onClick={() => setSelectedCta(segment.id)}
                      className="text-left"
                    >
                      <Card
                        className={cn(
                          "transition-all",
                          selectedCta === segment.id
                            ? "border-violet-500 ring-1 ring-violet-500/30"
                            : "hover:border-muted-foreground/30"
                        )}
                      >
                        <CardContent className="flex flex-col gap-2">
                          <div className="relative flex aspect-video items-center justify-center rounded-lg bg-muted">
                            <Play className="size-8 text-muted-foreground" />
                            {selectedCta === segment.id && (
                              <div className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-violet-500">
                                <Check className="size-3 text-white" />
                              </div>
                            )}
                          </div>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {segment.script_text}
                          </p>
                        </CardContent>
                      </Card>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
