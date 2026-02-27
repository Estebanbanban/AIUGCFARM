"use client";

export const dynamic = "force-dynamic";

import { useState, useRef, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  X,
  Loader2,
  AlertCircle,
  Clock,
  FileText,
  Video,
  RefreshCw,
  Play,
  Pause,
  Download,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Send,
  Scissors,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useGenerationStatus, useRegenerateSegment } from "@/hooks/use-generations";
import type { GenerationStatus, ScriptSegment, SegmentVideo } from "@/types/database";
import { trackVideoCompleted } from "@/lib/datafast";
import { useVideoStitcher, STITCH_STATUS_LABELS } from "@/hooks/use-video-stitcher";

/* -------------------------------------------------------------------------- */
/*  Status configuration                                                      */
/* -------------------------------------------------------------------------- */

const statusConfig: Record<
  GenerationStatus,
  { label: string; badgeClass: string }
> = {
  pending: {
    label: "Starting...",
    badgeClass: "bg-zinc-500/10 text-zinc-400",
  },
  scripting: {
    label: "Writing scripts...",
    badgeClass: "bg-amber-500/10 text-amber-400",
  },
  awaiting_approval: {
    label: "Preparing...",
    badgeClass: "bg-amber-500/10 text-amber-400",
  },
  locking: {
    label: "Processing...",
    badgeClass: "bg-amber-500/10 text-amber-400",
  },
  submitting_jobs: {
    label: "Submitting video jobs...",
    badgeClass: "bg-primary/10 text-primary",
  },
  generating_segments: {
    label: "Generating segments...",
    badgeClass: "bg-blue-500/10 text-blue-400",
  },
  completed: {
    label: "Complete",
    badgeClass: "bg-emerald-500/10 text-emerald-400",
  },
  failed: {
    label: "Failed",
    badgeClass: "bg-red-500/10 text-red-400",
  },
};

/* -------------------------------------------------------------------------- */
/*  Pipeline stages                                                           */
/* -------------------------------------------------------------------------- */

interface PipelineStage {
  key: string;
  label: string;
  icon: React.ReactNode;
  activeStatuses: GenerationStatus[];
  doneStatuses: GenerationStatus[];
}

const pipelineStages: PipelineStage[] = [
  {
    key: "scripting",
    label: "Writing Script & POV Image",
    icon: <FileText className="size-4" />,
    activeStatuses: ["pending", "scripting", "awaiting_approval"],
    doneStatuses: ["submitting_jobs", "generating_segments", "completed"],
  },
  {
    key: "submitting",
    label: "Submitting Video Jobs",
    icon: <Send className="size-4" />,
    activeStatuses: ["submitting_jobs"],
    doneStatuses: ["generating_segments", "completed"],
  },
  {
    key: "segments",
    label: "Generating Video Segments",
    icon: <Video className="size-4" />,
    activeStatuses: ["generating_segments"],
    doneStatuses: ["completed"],
  },
  {
    key: "complete",
    label: "Complete",
    icon: <Check className="size-4" />,
    activeStatuses: [],
    doneStatuses: ["completed"],
  },
];

function getStageState(
  stage: PipelineStage,
  currentStatus: GenerationStatus
): "done" | "active" | "pending" {
  if (currentStatus === "failed") return "pending";
  if (stage.doneStatuses.includes(currentStatus)) return "done";
  if (stage.activeStatuses.includes(currentStatus)) return "active";
  return "pending";
}

/* -------------------------------------------------------------------------- */
/*  Loading skeleton                                                          */
/* -------------------------------------------------------------------------- */

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Script segment card                                                       */
/* -------------------------------------------------------------------------- */

function ScriptSegmentCard({
  segment,
  type,
}: {
  segment: ScriptSegment;
  type: string;
}) {
  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {segment.duration_seconds}s
        </Badge>
        <Badge variant="secondary" className="text-xs capitalize">
          {segment.variant_label}
        </Badge>
        <span className="text-xs text-muted-foreground capitalize">{type}</span>
      </div>
      <p className="text-sm text-foreground">{segment.text}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Video segment card                                                        */
/* -------------------------------------------------------------------------- */

function VideoSegmentCard({
  video,
  label,
  isSelected,
  onSelect,
  onRegenerate,
  isRegenerating,
}: {
  video: SegmentVideo;
  label: string;
  isSelected: boolean;
  onSelect: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  function togglePlay() {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play();
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  }

  function handleDownload() {
    window.open(video.url, "_blank");
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border-2 text-left transition-all",
        isSelected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-muted-foreground/40"
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-full bg-primary">
          <Check className="size-3.5 text-white" />
        </div>
      )}

      {/* Video player */}
      <div className="relative aspect-[9/16] w-full bg-black">
        <video
          ref={videoRef}
          src={video.url}
          className="size-full object-contain"
          preload="metadata"
          playsInline
          onEnded={() => setIsPlaying(false)}
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
        />
        {/* Play/Pause overlay */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity",
            isPlaying
              ? "opacity-0 hover:opacity-100"
              : "opacity-100"
          )}
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
            {isPlaying ? (
              <Pause className="size-5" />
            ) : (
              <Play className="ml-0.5 size-5" />
            )}
          </div>
        </div>
      </div>

      {/* Card info */}
      <div className="flex items-center justify-between px-3 py-2">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <Badge variant="secondary" className="text-xs capitalize">
              {video.variant_label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {video.duration}s
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            title="Regenerate this segment (1 credit)"
            disabled={isRegenerating}
            onClick={(e) => {
              e.stopPropagation();
              onRegenerate();
            }}
          >
            {isRegenerating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
          >
            <Download className="size-4" />
          </Button>
        </div>
      </div>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Combination preview player                                                */
/* -------------------------------------------------------------------------- */

function CombinationPreview({
  hookVideo,
  bodyVideo,
  ctaVideo,
  generationId,
}: {
  hookVideo: SegmentVideo | undefined;
  bodyVideo: SegmentVideo | undefined;
  ctaVideo: SegmentVideo | undefined;
  generationId: string;
}) {
  const hookRef = useRef<HTMLVideoElement>(null);
  const bodyRef = useRef<HTMLVideoElement>(null);
  const ctaRef = useRef<HTMLVideoElement>(null);
  const stitchedRef = useRef<HTMLVideoElement>(null);

  const [currentSegment, setCurrentSegment] = useState<
    "idle" | "hook" | "body" | "cta"
  >("idle");
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<"sequential" | "stitched">(
    "sequential",
  );

  const { stitch, reset, status: stitchStatus, stitchedUrl, error: stitchError } =
    useVideoStitcher();

  const isStitching =
    stitchStatus !== "idle" &&
    stitchStatus !== "done" &&
    stitchStatus !== "error";

  const stopAll = useCallback(() => {
    hookRef.current?.pause();
    bodyRef.current?.pause();
    ctaRef.current?.pause();
    stitchedRef.current?.pause();
    setCurrentSegment("idle");
    setIsPlaying(false);
  }, []);

  function playSequence() {
    stopAll();
    if (!hookRef.current) return;
    hookRef.current.currentTime = 0;
    hookRef.current.play();
    setCurrentSegment("hook");
    setIsPlaying(true);
  }

  function handleHookEnded() {
    if (bodyRef.current) {
      bodyRef.current.currentTime = 0;
      bodyRef.current.play();
      setCurrentSegment("body");
    }
  }

  function handleBodyEnded() {
    if (ctaRef.current) {
      ctaRef.current.currentTime = 0;
      ctaRef.current.play();
      setCurrentSegment("cta");
    }
  }

  function handleCtaEnded() {
    stopAll();
  }

  function togglePlay() {
    if (viewMode === "stitched" && stitchedRef.current) {
      if (isPlaying) {
        stitchedRef.current.pause();
        setIsPlaying(false);
      } else {
        stitchedRef.current.play();
        setIsPlaying(true);
      }
      return;
    }
    if (isPlaying) {
      stopAll();
    } else {
      playSequence();
    }
  }

  // Reset when selection changes
  useEffect(() => {
    stopAll();
    reset();
    setViewMode("sequential");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hookVideo?.url, bodyVideo?.url, ctaVideo?.url]);

  // Auto-switch to stitched view when done
  useEffect(() => {
    if (stitchStatus === "done" && stitchedUrl) {
      stopAll();
      setViewMode("stitched");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stitchStatus, stitchedUrl]);

  function handleStitch() {
    if (!hookVideo || !bodyVideo || !ctaVideo) return;
    stitch(hookVideo.url, bodyVideo.url, ctaVideo.url);
  }

  function handleDownloadStitched() {
    if (!stitchedUrl) return;
    const a = document.createElement("a");
    a.href = stitchedUrl;
    a.download = `${generationId}_stitched.mp4`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const segmentLabels: Record<string, string> = {
    idle: "Ready to preview",
    hook: "Playing Hook",
    body: "Playing Body",
    cta: "Playing CTA",
  };

  if (!hookVideo || !bodyVideo || !ctaVideo) {
    return (
      <div className="flex aspect-[9/16] max-w-xs items-center justify-center rounded-xl bg-muted">
        <p className="text-sm text-muted-foreground">
          Select all segments to preview
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative aspect-[9/16] w-full max-w-xs overflow-hidden rounded-xl bg-black">

        {/* ── Stitched single video (shown after stitching) ── */}
        {viewMode === "stitched" && stitchedUrl && (
          <>
            <video
              ref={stitchedRef}
              src={stitchedUrl}
              className="absolute inset-0 z-10 size-full object-contain"
              playsInline
              onEnded={() => setIsPlaying(false)}
            />
            <Badge className="absolute bottom-3 left-3 z-30 bg-black/70 text-white backdrop-blur-sm">
              Stitched
            </Badge>
          </>
        )}

        {/* ── Sequential stacked videos (default / fallback) ── */}
        <video
          ref={hookRef}
          src={hookVideo.url}
          className={cn(
            "absolute inset-0 size-full object-contain",
            viewMode === "sequential" && currentSegment === "hook"
              ? "z-10"
              : "z-0 hidden",
          )}
          preload="metadata"
          playsInline
          onEnded={handleHookEnded}
        />
        <video
          ref={bodyRef}
          src={bodyVideo.url}
          className={cn(
            "absolute inset-0 size-full object-contain",
            viewMode === "sequential" && currentSegment === "body"
              ? "z-10"
              : "z-0 hidden",
          )}
          preload="metadata"
          playsInline
          onEnded={handleBodyEnded}
        />
        <video
          ref={ctaRef}
          src={ctaVideo.url}
          className={cn(
            "absolute inset-0 size-full object-contain",
            viewMode === "sequential" && currentSegment === "cta"
              ? "z-10"
              : "z-0 hidden",
          )}
          preload="metadata"
          playsInline
          onEnded={handleCtaEnded}
        />

        {/* Play overlay when idle */}
        {currentSegment === "idle" && !isPlaying && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <video
              src={hookVideo.url}
              className="absolute inset-0 size-full object-contain opacity-40"
              preload="metadata"
              playsInline
              muted
            />
            <button
              type="button"
              onClick={togglePlay}
              className="relative z-10 flex size-16 items-center justify-center rounded-full bg-primary/90 text-white backdrop-blur-sm transition-transform hover:scale-105"
            >
              <Play className="ml-1 size-7" />
            </button>
          </div>
        )}

        {/* Pause overlay when playing */}
        {isPlaying && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 z-20 flex items-center justify-center bg-transparent opacity-0 transition-opacity hover:opacity-100"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
              <Pause className="size-5" />
            </div>
          </button>
        )}

        {/* Segment indicator (sequential mode) */}
        {viewMode === "sequential" && currentSegment !== "idle" && (
          <div className="absolute bottom-3 left-3 z-30">
            <Badge className="bg-black/70 text-white backdrop-blur-sm">
              {segmentLabels[currentSegment]}
            </Badge>
          </div>
        )}
      </div>

      {/* Play controls */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={togglePlay}>
          {isPlaying ? (
            <>
              <Pause className="size-3.5" />
              Stop
            </>
          ) : (
            <>
              <Play className="size-3.5" />
              {viewMode === "stitched" ? "Play Stitched" : "Play Combination"}
            </>
          )}
        </Button>
        {viewMode === "sequential" && (
          <span className="text-xs text-muted-foreground">
            {segmentLabels[currentSegment]}
          </span>
        )}
        {viewMode === "stitched" && (
          <button
            type="button"
            onClick={() => { stopAll(); setViewMode("sequential"); }}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Back to segments
          </button>
        )}
      </div>

      {/* ── Stitch bar ── */}
      <div className="w-full rounded-lg border border-border bg-muted/40 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-medium text-foreground">
              Stitch &amp; Export
            </p>
            <p className="text-xs text-muted-foreground">
              Trims silence, joins Hook → Body → CTA into one file
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {stitchStatus === "done" && stitchedUrl && (
              <Button size="sm" variant="outline" onClick={handleDownloadStitched}>
                <Download className="size-3.5" />
                Download
              </Button>
            )}

            <Button
              size="sm"
              onClick={
                stitchStatus === "done" ? handleDownloadStitched : handleStitch
              }
              disabled={isStitching}
            >
              {isStitching ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  {STITCH_STATUS_LABELS[stitchStatus]}
                </>
              ) : stitchStatus === "done" ? (
                <>
                  <Scissors className="size-3.5" />
                  Re-stitch
                </>
              ) : (
                <>
                  <Scissors className="size-3.5" />
                  {STITCH_STATUS_LABELS[stitchStatus]}
                </>
              )}
            </Button>
          </div>
        </div>

        {stitchError && (
          <p className="mt-2 text-xs text-red-400">{stitchError}</p>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main page component                                                       */
/* -------------------------------------------------------------------------- */

export default function GenerationDetailPage() {
  const params = useParams();
  const generationId = params.id as string;

  const {
    data: gen,
    isLoading,
    error,
    refetch,
  } = useGenerationStatus(generationId);
  const regenerateSegment = useRegenerateSegment();

  // Script collapsible state
  const [scriptExpanded, setScriptExpanded] = useState(true);

  // Combination builder selection
  const [selectedHook, setSelectedHook] = useState(0);
  const [selectedBody, setSelectedBody] = useState(0);
  const [selectedCta, setSelectedCta] = useState(0);
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);

  const status = (gen?.status as GenerationStatus) ?? "pending";
  const config = statusConfig[status] ?? statusConfig.scripting;
  const isComplete = status === "completed";
  const isFailed = status === "failed";
  const isProcessing = !isComplete && !isFailed;

  const segments = gen?.segments ?? null;
  const script = gen?.script ?? null;
  const progress = gen?.progress;

  // Collapse script when videos are ready
  useEffect(() => {
    if (isComplete && segments) {
      setScriptExpanded(false);
      trackVideoCompleted(gen?.mode ?? "unknown");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, segments]);

  /* ----- Download all segments ----- */
  function handleDownloadAll() {
    if (!segments) return;
    const allVideos = [
      ...(segments.hooks ?? []).map((v, i) => ({ ...v, label: `hook_${i + 1}` })),
      ...(segments.bodies ?? []).map((v, i) => ({ ...v, label: `body_${i + 1}` })),
      ...(segments.ctas ?? []).map((v, i) => ({ ...v, label: `cta_${i + 1}` })),
    ];
    // Use programmatic anchor click to avoid popup blocker
    allVideos.forEach((v) => {
      const a = document.createElement("a");
      a.href = v.url;
      a.download = `${generationId}_${v.label}.mp4`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
    toast.success(`Downloading ${allVideos.length} segments`);
  }

  async function handleRegenerateSegment(
    segmentType: "hook" | "body" | "cta",
    variation: number,
  ) {
    if (regenerateSegment.isPending) return;
    const jobKey = `${segmentType}_${variation}`;
    try {
      setRegeneratingKey(jobKey);
      await regenerateSegment.mutateAsync({
        generation_id: generationId,
        segment_type: segmentType,
        variation,
      });
      toast.success(
        `Regenerating ${segmentType.toUpperCase()} ${variation}. 1 credit used.`,
      );
      refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to regenerate segment.",
      );
    } finally {
      setRegeneratingKey(null);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Loading state                                                          */
  /* ---------------------------------------------------------------------- */

  if (isLoading && !gen) {
    return <LoadingSkeleton />;
  }

  /* ---------------------------------------------------------------------- */
  /*  Error state -- could not fetch at all                                  */
  /* ---------------------------------------------------------------------- */

  if (error && !gen) {
    const is404 =
      error.message?.includes("not found") ||
      error.message?.includes("Not found") ||
      error.message?.includes("404");

    if (is404) {
      return (
        <div className="flex flex-col items-center gap-6 py-20">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <AlertCircle className="size-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">
              Generation Not Found
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The generation you are looking for does not exist or you do not
              have access to it.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/generate">
              <ArrowLeft className="size-4" />
              Back to Generate
            </Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-6 py-20">
        <div className="flex size-16 items-center justify-center rounded-full bg-red-500/10">
          <AlertCircle className="size-8 text-red-400" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error.message || "Failed to load generation status."}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            refetch();
            toast.info("Retrying...");
          }}
        >
          <RefreshCw className="size-4" />
          Retry
        </Button>
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /*  Main content                                                           */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="flex flex-col gap-6">
      {/* ---------------------------------------------------------------- */}
      {/*  Header                                                           */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/generate">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Generation Result
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            ID: {generationId.slice(0, 8)}...
          </p>
        </div>
        {isProcessing && (
          <Badge variant="secondary" className={config.badgeClass}>
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

      {/* ---------------------------------------------------------------- */}
      {/*  Progress section                                                 */}
      {/* ---------------------------------------------------------------- */}
      {isProcessing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Pipeline Progress</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Progress bar for segment generation */}
            {progress && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Segments generated
                  </span>
                  <span className="font-medium text-foreground">
                    {progress.completed}/{progress.total}
                  </span>
                </div>
                <Progress
                  value={
                    progress.total > 0
                      ? (progress.completed / progress.total) * 100
                      : 0
                  }
                  className="h-2 bg-muted [&>[data-slot=progress-indicator]]:bg-primary"
                />
              </div>
            )}

            {/* Stage indicators */}
            <div className="flex flex-col gap-1">
              {pipelineStages.map((stage, i) => {
                const state = getStageState(stage, status);
                return (
                  <div key={stage.key} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          "flex size-8 items-center justify-center rounded-full",
                          state === "done"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : state === "active"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        {state === "done" ? (
                          <Check className="size-4" />
                        ) : state === "active" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          stage.icon
                        )}
                      </div>
                      {i < pipelineStages.length - 1 && (
                        <div
                          className={cn(
                            "my-1 h-4 w-px",
                            state === "done"
                              ? "bg-emerald-500/30"
                              : "bg-border"
                          )}
                        />
                      )}
                    </div>
                    <div className="flex min-h-8 items-center">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          state === "done"
                            ? "text-emerald-400"
                            : state === "active"
                              ? "text-foreground"
                              : "text-muted-foreground"
                        )}
                      >
                        {stage.label}
                        {stage.key === "segments" &&
                          state === "active" &&
                          progress && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({progress.completed}/{progress.total})
                            </span>
                          )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/*  Error Message (non-fatal during processing)                      */}
      {/* ---------------------------------------------------------------- */}
      {gen?.error_message && !isFailed && (
        <Card className="border-amber-500/30">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="size-5 shrink-0 text-amber-400" />
            <p className="text-sm text-amber-400">{gen.error_message}</p>
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/*  POV Composite Image                                              */}
      {/* ---------------------------------------------------------------- */}
      {gen?.composite_image_url && (
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">
              POV Composite Image
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-[9/16] max-w-xs overflow-hidden rounded-lg bg-muted">
              <img
                src={gen.composite_image_url}
                alt="POV composite"
                className="size-full object-cover"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/*  Script preview (collapsible)                                     */}
      {/* ---------------------------------------------------------------- */}
      {script && (
        <Card>
          <CardHeader>
            <button
              type="button"
              onClick={() => setScriptExpanded(!scriptExpanded)}
              className="flex w-full items-center justify-between"
            >
              <CardTitle className="text-foreground">
                Generated Script
              </CardTitle>
              {scriptExpanded ? (
                <ChevronUp className="size-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-5 text-muted-foreground" />
              )}
            </button>
          </CardHeader>
          {scriptExpanded && (
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                {/* Hooks */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Hooks ({script.hooks?.length ?? 0})
                  </h3>
                  {script.hooks?.map((seg, i) => (
                    <ScriptSegmentCard
                      key={i}
                      segment={seg}
                      type={`Hook ${i + 1}`}
                    />
                  ))}
                  {(!script.hooks || script.hooks.length === 0) && (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No hook variants yet.
                    </p>
                  )}
                </div>

                {/* Bodies */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Bodies ({script.bodies?.length ?? 0})
                  </h3>
                  {script.bodies?.map((seg, i) => (
                    <ScriptSegmentCard
                      key={i}
                      segment={seg}
                      type={`Body ${i + 1}`}
                    />
                  ))}
                  {(!script.bodies || script.bodies.length === 0) && (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No body variants yet.
                    </p>
                  )}
                </div>

                {/* CTAs */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    CTAs ({script.ctas?.length ?? 0})
                  </h3>
                  {script.ctas?.map((seg, i) => (
                    <ScriptSegmentCard
                      key={i}
                      segment={seg}
                      type={`CTA ${i + 1}`}
                    />
                  ))}
                  {(!script.ctas || script.ctas.length === 0) && (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No CTA variants yet.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/*  Segment grid (shown when completed)                              */}
      {/* ---------------------------------------------------------------- */}
      {isComplete && segments && (
        <>
          {/* Download all button */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Video Segments
              </h2>
              <p className="text-xs text-muted-foreground">
                Regenerate any single segment for 1 credit.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadAll}>
              <Download className="size-4" />
              Download All Segments
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Hooks column */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-primary">Hooks</h3>
              {segments.hooks?.map((video, i) => (
                <VideoSegmentCard
                  key={i}
                  video={video}
                  label={`Hook ${i + 1}`}
                  isSelected={selectedHook === i}
                  onSelect={() => setSelectedHook(i)}
                  onRegenerate={() => handleRegenerateSegment("hook", i + 1)}
                  isRegenerating={regeneratingKey === `hook_${i + 1}`}
                />
              ))}
              {(!segments.hooks || segments.hooks.length === 0) && (
                <div className="flex aspect-[9/16] items-center justify-center rounded-xl border border-dashed border-border">
                  <p className="text-sm text-muted-foreground">
                    No hook segments
                  </p>
                </div>
              )}
            </div>

            {/* Bodies column */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-primary">Bodies</h3>
              {segments.bodies?.map((video, i) => (
                <VideoSegmentCard
                  key={i}
                  video={video}
                  label={`Body ${i + 1}`}
                  isSelected={selectedBody === i}
                  onSelect={() => setSelectedBody(i)}
                  onRegenerate={() => handleRegenerateSegment("body", i + 1)}
                  isRegenerating={regeneratingKey === `body_${i + 1}`}
                />
              ))}
              {(!segments.bodies || segments.bodies.length === 0) && (
                <div className="flex aspect-[9/16] items-center justify-center rounded-xl border border-dashed border-border">
                  <p className="text-sm text-muted-foreground">
                    No body segments
                  </p>
                </div>
              )}
            </div>

            {/* CTAs column */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-primary">CTAs</h3>
              {segments.ctas?.map((video, i) => (
                <VideoSegmentCard
                  key={i}
                  video={video}
                  label={`CTA ${i + 1}`}
                  isSelected={selectedCta === i}
                  onSelect={() => setSelectedCta(i)}
                  onRegenerate={() => handleRegenerateSegment("cta", i + 1)}
                  isRegenerating={regeneratingKey === `cta_${i + 1}`}
                />
              ))}
              {(!segments.ctas || segments.ctas.length === 0) && (
                <div className="flex aspect-[9/16] items-center justify-center rounded-xl border border-dashed border-border">
                  <p className="text-sm text-muted-foreground">
                    No CTA segments
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* -------------------------------------------------------------- */}
          {/*  Combination builder                                            */}
          {/* -------------------------------------------------------------- */}
          <Separator />

          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">
                Combination Preview
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Select one hook, one body, and one CTA above, then preview the
                full combination here.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:gap-8">
                {/* Preview player */}
                <CombinationPreview
                  hookVideo={segments.hooks?.[selectedHook]}
                  bodyVideo={segments.bodies?.[selectedBody]}
                  ctaVideo={segments.ctas?.[selectedCta]}
                  generationId={generationId}
                />

                {/* Selection summary */}
                <div className="flex flex-1 flex-col gap-4">
                  <h4 className="text-sm font-semibold text-foreground">
                    Selected Combination
                  </h4>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                        <span className="text-xs font-bold text-primary">
                          H
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          Hook {selectedHook + 1}
                        </p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {segments.hooks?.[selectedHook]?.variant_label ??
                            "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                        <span className="text-xs font-bold text-primary">
                          B
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          Body {selectedBody + 1}
                        </p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {segments.bodies?.[selectedBody]?.variant_label ??
                            "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                        <span className="text-xs font-bold text-primary">
                          C
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          CTA {selectedCta + 1}
                        </p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {segments.ctas?.[selectedCta]?.variant_label ?? "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {gen?.mode === "single"
                      ? "1 hook · 1 body · 1 CTA, your complete ad."
                      : "3 hooks x 3 bodies x 3 CTAs = 27 possible combinations. Select different segments above to preview other combinations."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ---------------------------------------------------------------- */}
      {/*  Failed generation error                                          */}
      {/* ---------------------------------------------------------------- */}
      {isFailed && (
        <Card className="border-red-500/30">
          <CardContent className="flex flex-col gap-4 py-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-400" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-red-400">
                  Generation Failed
                </p>
                <p className="text-sm text-muted-foreground">
                  {gen?.error_message ||
                    "An error occurred during generation. Please try again."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-4 py-3">
              <Clock className="size-4 shrink-0 text-amber-400" />
              <p className="text-sm text-amber-400">
                Your credits have been refunded to your account.
              </p>
            </div>

            <Button asChild variant="outline" className="w-fit">
              <Link href="/generate">
                <RefreshCw className="size-4" />
                Try Again
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
