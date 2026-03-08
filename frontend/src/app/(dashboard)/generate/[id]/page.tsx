"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  X,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Cpu,
  FileText,
  Video,
  RefreshCw,
  Play,
  Pause,
  Download,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Send,
  Scissors,
  Layers,
  CheckSquare,
  Square,
  Sparkles,
  Zap,
  LayoutDashboard,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useGenerationStatus, useRegenerateSegment, useApproveAndGenerate } from "@/hooks/use-generations";
import { useCredits } from "@/hooks/use-credits";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { GenerationStatus, ScriptSegment, SegmentVideo } from "@/types/database";
import { generateSrt, buildWordCues, type WordCue } from "@/lib/srt";
import { burnCaptionsToVideo } from "@/lib/burn-captions";
import { trackVideoCompleted, trackVideoFailed, trackVideoDownloaded } from "@/lib/datafast";
import { useVideoStitcher, STITCH_STATUS_LABELS } from "@/hooks/use-video-stitcher";
import { useZipDownload } from "@/hooks/use-zip-download";
import { useBatchStitcher } from "@/hooks/use-batch-stitcher";
import { useWatchedGenerationsStore } from "@/stores/watched-generations";
import { useGenerationWizardStore } from "@/stores/generation-wizard";
import { NanoBananaLoader } from "@/components/ui/nano-loader";

/** Strip Supabase project URLs from messages shown to users. */
function sanitizeMsg(msg: string): string {
  return msg.replace(/https?:\/\/[a-z0-9]+\.supabase\.(co|in)\/[^\s]*/g, "[internal]");
}

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
    activeStatuses: ["locking", "submitting_jobs"],
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
/*  Video generating screen                                                   */
/* -------------------------------------------------------------------------- */

const PROGRESS_STEPS = [
  { label: "Submitting to AI model", doneAt: 3 },
  { label: "Rendering hook segment", doneAt: 20 },
  { label: "Rendering body segment", doneAt: 40 },
  { label: "Rendering CTA segment", doneAt: 60 },
  { label: "Finalising your video", doneAt: 75 },
];

const MOTIVATIONAL_MESSAGES = [
  "Great UGC ads have 3x higher click rates than traditional ads",
  "You're about to save $300+ compared to hiring a creator",
  "Top brands make 10-15 UGC variants per product",
  "Short-form video converts 80% better than static images",
  "AI-generated UGC scales production without scaling costs",
];

function VideoGeneratingScreen({
  productName,
  progress: segmentProgress,
  status,
}: {
  productName?: string;
  progress?: { completed: number; total: number } | null;
  status: GenerationStatus;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [motivationalIdx, setMotivationalIdx] = useState(0);

  // Elapsed timer
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Cycle motivational messages every 8 seconds
  useEffect(() => {
    const id = setInterval(
      () => setMotivationalIdx((i) => (i + 1) % MOTIVATIONAL_MESSAGES.length),
      8000,
    );
    return () => clearInterval(id);
  }, []);

  // Use real segment progress if available, otherwise fall back to time-based steps
  const realProgress =
    segmentProgress && segmentProgress.total > 0
      ? (segmentProgress.completed / segmentProgress.total) * 100
      : null;

  return (
    <div className="flex flex-col items-center gap-8 py-6">
      {/* Animated header */}
      <div className="text-center space-y-2">
        <h2
          className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-primary bg-[length:200%_auto] bg-clip-text text-transparent"
          style={{
            animation: "gradient-shift 3s ease-in-out infinite",
          }}
        >
          Creating your ad...
        </h2>
        {productName && (
          <p className="text-sm text-muted-foreground">{productName}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Your video is being generated by AI
        </p>
      </div>

      {/* Animated video skeleton cards */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="aspect-[9/16] rounded-xl bg-muted overflow-hidden relative"
          >
            {/* Shimmer effect */}
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent"
              style={{
                animation: `shimmer 2s ease-in-out infinite`,
                animationDelay: `${i * 200}ms`,
                transform: "translateX(-100%)",
              }}
            />
            {/* Play button icon in center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="size-10 rounded-full bg-foreground/10 flex items-center justify-center animate-pulse">
                <Play className="size-4 text-muted-foreground/40 ml-0.5" />
              </div>
            </div>
            {/* Segment label */}
            <div className="absolute bottom-2 inset-x-0 text-center">
              <span className="text-[10px] font-medium text-muted-foreground/50">
                {["Hook", "Body", "CTA"][i]}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {realProgress !== null && (
        <div className="w-full max-w-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Segments generated</span>
            <span className="font-medium text-foreground">
              {segmentProgress!.completed}/{segmentProgress!.total}
            </span>
          </div>
          <Progress
            value={realProgress}
            className="h-2 bg-muted [&>[data-slot=progress-indicator]]:bg-primary"
          />
        </div>
      )}

      {/* Progress steps */}
      <div className="w-full max-w-sm space-y-2">
        {PROGRESS_STEPS.map((step, i) => {
          const isDone = elapsed >= step.doneAt;
          const isActive =
            !isDone &&
            (i === 0 || elapsed >= PROGRESS_STEPS[i - 1].doneAt);
          return (
            <div key={i} className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-6 items-center justify-center rounded-full transition-colors duration-500",
                  isDone
                    ? "bg-emerald-500/10 text-emerald-400"
                    : isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {isDone ? (
                  <Check className="size-3.5" />
                ) : isActive ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <span className="text-[10px] font-medium">{i + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-sm transition-colors duration-500",
                  isDone
                    ? "text-emerald-400"
                    : isActive
                      ? "text-foreground font-medium"
                      : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Elapsed time + ETA */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="size-3" />
          Running for {elapsed}s
        </span>
        <span className="text-border">|</span>
        <span>Usually ready in ~75 seconds</span>
      </div>

      {/* Motivational messages */}
      <div className="w-full max-w-sm rounded-xl bg-muted/50 px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="size-3.5 text-primary shrink-0" />
          <p
            key={motivationalIdx}
            className="text-xs text-muted-foreground"
            style={{
              animation: "fade-in-message 0.5s ease-in-out",
            }}
          >
            {MOTIVATIONAL_MESSAGES[motivationalIdx]}
          </p>
        </div>
      </div>

      {/* Productive wait CTAs */}
      <div className="w-full max-w-sm space-y-2">
        <p className="text-xs font-medium text-muted-foreground text-center">
          While you wait
        </p>
        <div className="flex gap-2 justify-center">
          <Button asChild size="sm" variant="outline">
            <Link href="/generate">New generation</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/personas/new">New persona</Link>
          </Button>
        </div>
      </div>

      {/* Inline CSS animations */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% center; }
          50% { background-position: 100% center; }
        }
        @keyframes fade-in-message {
          0% { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
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
        <Badge variant="secondary" className="text-xs">
          {(segment.variant_label ?? '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
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
  multiSelect = false,
  regenRemaining = 0,
  scriptText,
}: {
  video: SegmentVideo;
  label: string;
  isSelected: boolean;
  onSelect: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  multiSelect?: boolean;
  regenRemaining?: number;
  scriptText?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [activeWordIdx, setActiveWordIdx] = useState(-1);
  const [burning, setBurning] = useState(false);
  const [burnProgress, setBurnProgress] = useState(0);

  const wordCues = useMemo<WordCue[]>(
    () => (scriptText ? buildWordCues(scriptText, video.duration) : []),
    [scriptText, video.duration],
  );

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !captionsOn || wordCues.length === 0) return;
    function onTimeUpdate() {
      const t = el!.currentTime;
      const idx = wordCues.findIndex((w) => t >= w.start && t < w.end);
      setActiveWordIdx(idx);
    }
    function onEnded() { setActiveWordIdx(-1); }
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", onEnded);
    };
  }, [captionsOn, wordCues]);

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

  async function handleDownload() {
    trackVideoDownloaded("segment");
    try {
      const response = await fetch(video.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `cinerads-${label.replace(/\s+/g, "-").toLowerCase()}.mp4`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback to opening in new tab if blob fetch fails
      window.open(video.url, "_blank");
    }
  }

  async function handleDownloadWithCaptions() {
    if (wordCues.length === 0 || burning) return;
    setBurning(true);
    setBurnProgress(0);
    try {
      const { blob, mimeType } = await burnCaptionsToVideo(
        video.url,
        wordCues,
        ({ ratio }) => setBurnProgress(Math.round(ratio * 100)),
      );
      const ext = mimeType === "video/mp4" ? "mp4" : "webm";
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `cinerads-${label.replace(/\s+/g, "-").toLowerCase()}-captions.${ext}`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      trackVideoDownloaded("segment");
    } catch {
      toast.error("Failed to burn captions. Try downloading the .srt instead.");
    } finally {
      setBurning(false);
      setBurnProgress(0);
    }
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-xl border-2 text-left transition-all",
        isSelected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-muted-foreground/40"
      )}
    >
      {/* Selection indicator */}
      {multiSelect ? (
        <div className={cn(
          "absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded",
          isSelected ? "bg-primary text-primary-foreground" : "bg-black/40 text-white/60"
        )}>
          {isSelected
            ? <CheckSquare className="size-4" />
            : <Square className="size-4" />}
        </div>
      ) : isSelected && (
        <div className="absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-full bg-primary">
          <Check className="size-3.5 text-primary-foreground" />
        </div>
      )}

      {/* Video player */}
      <div className="relative aspect-[9/16] w-full bg-black dark:bg-black">
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

        {/* Word-by-word caption overlay — shows current page of 8 words */}
        {captionsOn && wordCues.length > 0 && activeWordIdx >= 0 && (
          <div className="pointer-events-none absolute bottom-5 left-0 right-0 z-30 flex justify-center px-3">
            <div className="max-w-[88%] rounded-lg bg-black/75 px-3 py-2 text-center">
              <p className="text-[15px] font-bold leading-snug tracking-wide">
                {(() => {
                  const PAGE = 8;
                  const start = Math.floor(activeWordIdx / PAGE) * PAGE;
                  return wordCues.slice(start, start + PAGE).map((w, j) => (
                    <span
                      key={start + j}
                      className={start + j === activeWordIdx ? "text-yellow-300" : "text-white"}
                    >
                      {w.word}{" "}
                    </span>
                  ));
                })()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Card info */}
      <div className="flex items-center justify-between px-3 py-2">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {(video.variant_label ?? '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {video.duration}s
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  disabled={isRegenerating || regenRemaining === 0}
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
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {regenRemaining === 0
                    ? "No credits remaining"
                    : `Regenerate (1 credit) · ${regenRemaining} regens left`}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {wordCues.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 shrink-0 text-[11px] font-bold",
                captionsOn && "bg-primary/10 text-primary",
              )}
              onClick={(e) => {
                e.stopPropagation();
                setCaptionsOn((v) => !v);
                setActiveWordIdx(-1);
              }}
              aria-label={captionsOn ? "Hide captions" : "Show captions"}
              title={captionsOn ? "Hide captions" : "Show captions"}
            >
              CC
            </Button>
          )}
          {wordCues.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 relative"
              disabled={burning}
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadWithCaptions();
              }}
              aria-label="Download with captions burned in"
              title={burning ? `Burning captions… ${burnProgress}%` : "Download with captions"}
            >
              {burning ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
            </Button>
          )}
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
  allSegmentEntries,
  hookScript,
  bodyScript,
  ctaScript,
  autoStitch = false,
}: {
  hookVideo: SegmentVideo | undefined;
  bodyVideo: SegmentVideo | undefined;
  ctaVideo: SegmentVideo | undefined;
  generationId: string;
  allSegmentEntries: Array<{ name: string; url: string }>;
  hookScript?: ScriptSegment;
  bodyScript?: ScriptSegment;
  ctaScript?: ScriptSegment;
  autoStitch?: boolean;
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

  const { stitch, reset, status: stitchStatus, progress: stitchProgress, stitchedUrl, error: stitchError } =
    useVideoStitcher();

  const {
    downloadZip: downloadPackZip,
    status: packZipStatus,
    fetchedCount: packFetched,
    totalCount: packTotal,
    isActive: isPackZipping,
  } = useZipDownload();

  // Track whether auto-stitch has been triggered for this combination
  const autoStitchTriggered = useRef(false);
  // Skip the "reset on selection change" effect on the very first mount
  const hasMounted = useRef(false);

  // Toast on Download Pack failure
  useEffect(() => {
    if (packZipStatus === "error") {
      toast.error("Pack download failed. Check your connection and try again.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packZipStatus]);

  // Toast on stitch failure
  useEffect(() => {
    if (stitchStatus === "error" && stitchError) {
      toast.error(stitchError);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stitchStatus]);

  // Auto-stitch when all segments are available and autoStitch is enabled
  useEffect(() => {
    if (
      autoStitch &&
      hookVideo &&
      bodyVideo &&
      ctaVideo &&
      stitchStatus === "idle" &&
      !autoStitchTriggered.current
    ) {
      autoStitchTriggered.current = true;
      stitch(hookVideo.url, bodyVideo.url, ctaVideo.url);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStitch, hookVideo?.url, bodyVideo?.url, ctaVideo?.url, stitchStatus]);

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

  // Reset when selection changes (skip on initial mount to avoid undoing the auto-stitch trigger)
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    stopAll();
    reset();
    setViewMode("sequential");
    autoStitchTriggered.current = false;
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
    trackVideoDownloaded("stitched");
    const a = document.createElement("a");
    a.href = stitchedUrl;
    a.download = `${generationId}_stitched.mp4`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleDownloadPack() {
    if (!stitchedUrl || !hookVideo || !bodyVideo || !ctaVideo || isPackZipping) return;
    trackVideoDownloaded("pack");
    // Derive combo label from selected video URLs for filename
    const h = allSegmentEntries.filter(e => e.name.startsWith("hooks/")).findIndex(e => e.url === hookVideo.url);
    const b = allSegmentEntries.filter(e => e.name.startsWith("bodies/")).findIndex(e => e.url === bodyVideo.url);
    const c = allSegmentEntries.filter(e => e.name.startsWith("ctas/")).findIndex(e => e.url === ctaVideo.url);
    const hi = h >= 0 ? h + 1 : 1;
    const bi = b >= 0 ? b + 1 : 1;
    const ci = c >= 0 ? c + 1 : 1;
    const comboLabel = `hook${hi}-body${bi}-cta${ci}`;
    downloadPackZip(
      [
        { name: `stitched/${comboLabel}.mp4`, url: stitchedUrl },
        ...allSegmentEntries,
      ],
      `cinerades-${generationId.slice(0, 8)}-pack.zip`,
    );
  }

  function handleDownloadSrt() {
    if (!hookVideo || !bodyVideo || !ctaVideo || !hookScript || !bodyScript || !ctaScript) return;
    const srt = generateSrt([
      { text: hookScript.text, durationS: hookVideo.duration },
      { text: bodyScript.text, durationS: bodyVideo.duration },
      { text: ctaScript.text, durationS: ctaVideo.duration },
    ]);
    const blob = new Blob([srt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cinerads-${generationId.slice(0, 8)}-captions.srt`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const hasSrt = !!(hookScript && bodyScript && ctaScript && hookVideo && bodyVideo && ctaVideo);

  // ── Word-by-word captions ──────────────────────────────────────────────────
  const [captionsOn, setCaptionsOn] = useState(false);
  const [captionActiveIdx, setCaptionActiveIdx] = useState(-1);

  const captionCues = useMemo<WordCue[]>(() => {
    if (!hookScript || !bodyScript || !ctaScript || !hookVideo || !bodyVideo || !ctaVideo) return [];
    return [
      ...buildWordCues(hookScript.text, hookVideo.duration, 0),
      ...buildWordCues(bodyScript.text, bodyVideo.duration, hookVideo.duration),
      ...buildWordCues(ctaScript.text, ctaVideo.duration, hookVideo.duration + bodyVideo.duration),
    ];
  }, [hookScript, bodyScript, ctaScript, hookVideo, bodyVideo, ctaVideo]);

  // rAF loop: compute global time from whichever video is currently active
  useEffect(() => {
    if (!captionsOn || captionCues.length === 0) return;
    let rafId: number;
    function tick() {
      let t = -1;
      if (viewMode === "stitched" && stitchedRef.current) {
        t = stitchedRef.current.currentTime;
      } else if (currentSegment === "hook" && hookRef.current) {
        t = hookRef.current.currentTime;
      } else if (currentSegment === "body" && bodyRef.current && hookVideo) {
        t = hookVideo.duration + bodyRef.current.currentTime;
      } else if (currentSegment === "cta" && ctaRef.current && hookVideo && bodyVideo) {
        t = hookVideo.duration + bodyVideo.duration + ctaRef.current.currentTime;
      }
      if (t >= 0) {
        const idx = captionCues.findIndex((w) => t >= w.start && t < w.end);
        setCaptionActiveIdx(idx);
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [captionsOn, captionCues, viewMode, currentSegment, hookVideo, bodyVideo]);

  const segmentLabels: Record<string, string> = {
    idle: "Ready to preview",
    hook: "Playing Hook",
    body: "Playing Body",
    cta: "Playing CTA",
  };

  if (!hookVideo || !bodyVideo || !ctaVideo) {
    return (
      <div className="flex aspect-[9/16] w-full max-w-xs items-center justify-center rounded-xl bg-muted">
        <p className="text-sm text-muted-foreground">
          Select all segments to preview
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative aspect-[9/16] w-full max-w-xs overflow-hidden rounded-xl bg-black dark:bg-black">

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

        {/* Word-by-word caption overlay — sequential mode only, current page of 8 words */}
        {captionsOn && viewMode === "sequential" && captionCues.length > 0 && captionActiveIdx >= 0 && (
          <div className="pointer-events-none absolute bottom-8 left-0 right-0 z-40 flex justify-center px-3">
            <div className="max-w-[88%] rounded-lg bg-black/75 px-3 py-2 text-center">
              <p className="text-[15px] font-bold leading-snug tracking-wide">
                {(() => {
                  const PAGE = 8;
                  const start = Math.floor(captionActiveIdx / PAGE) * PAGE;
                  return captionCues.slice(start, start + PAGE).map((w, j) => (
                    <span
                      key={start + j}
                      className={start + j === captionActiveIdx ? "text-yellow-300" : "text-white"}
                    >
                      {w.word}{" "}
                    </span>
                  ));
                })()}
              </p>
            </div>
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
        {captionCues.length > 0 && viewMode === "sequential" && (
          <Button
            variant={captionsOn ? "secondary" : "outline"}
            size="sm"
            onClick={() => { setCaptionsOn((v) => !v); setCaptionActiveIdx(-1); }}
            aria-label={captionsOn ? "Hide captions" : "Show captions"}
            title={captionsOn ? "Hide captions" : "Show captions"}
          >
            CC
          </Button>
        )}
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
      <div className={`w-full rounded-lg border px-4 py-3 ${stitchStatus === "error" ? "border-red-500/50 bg-red-500/5" : "border-border bg-muted/40"}`}>
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
            {stitchStatus === "done" && stitchedUrl ? (
              <>
                <Button size="sm" onClick={handleDownloadStitched}>
                  <Download className="size-3.5" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadPack}
                  disabled={isPackZipping}
                  title="Download stitched video + all raw segments as a ZIP"
                >
                  {isPackZipping ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      {packZipStatus === "fetching"
                        ? `Fetching… ${packFetched}/${packTotal}`
                        : "Zipping…"}
                    </>
                  ) : (
                    <>
                      <Download className="size-3.5" />
                      Download All (ZIP)
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleStitch}
                  disabled={isStitching}
                  title="Re-stitch the segments"
                >
                  <Scissors className="size-3.5" />
                  Re-stitch
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={handleStitch}
                disabled={isStitching}
              >
                {isStitching ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    {STITCH_STATUS_LABELS[stitchStatus]}
                  </>
                ) : (
                  <>
                    <Scissors className="size-3.5" />
                    {STITCH_STATUS_LABELS[stitchStatus]}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {isStitching && (
          <div className="mt-2">
            <Progress
              value={stitchProgress}
              className="h-1.5 bg-muted [&>[data-slot=progress-indicator]]:bg-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground text-right">{stitchProgress}%</p>
          </div>
        )}

        {stitchStatus === "error" && stitchError && (
          <div className="mt-2 flex items-start gap-1.5 text-red-400">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <p className="text-xs">{stitchError}</p>
          </div>
        )}
      </div>

      {/* SRT caption download */}
      {hasSrt && (
        <div className="w-full rounded-lg border border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-medium text-foreground">Captions (.srt)</p>
              <p className="text-xs text-muted-foreground">
                Import into CapCut, Premiere, or DaVinci to add subtitles
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleDownloadSrt}>
              <FileText className="size-3.5" />
              Download SRT
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  NanoBananaLoader rendering steps                                          */
/* -------------------------------------------------------------------------- */

const RENDER_STEPS = [
  { label: "Preparing video pipeline",   icon: <Cpu className="w-3 h-3" /> },
  { label: "Submitting to video engine",  icon: <Zap className="w-3 h-3" /> },
  { label: "Rendering video segments",   icon: <Video className="w-3 h-3" /> },
  { label: "Finalizing video",           icon: <Sparkles className="w-3 h-3" /> },
];

function statusToLoader(
  status: string,
  elapsedMs: number,
  segmentProgress?: { completed: number; total: number } | null,
): { step: number; progress: number } {
  switch (status) {
    case "pending":
    case "scripting":
      return { step: 0, progress: Math.min(elapsedMs / 60_000 * 15, 14) };
    case "awaiting_approval":
    case "locking":
      return { step: 1, progress: Math.min(15 + elapsedMs / 30_000 * 10, 24) };
    case "submitting_jobs":
      return { step: 1, progress: Math.min(25 + elapsedMs / 20_000 * 10, 34) };
    case "generating_segments": {
      // Use real segment progress when available (accurate) - fall back to elapsed time
      if (segmentProgress && segmentProgress.total > 0) {
        const realPct = (segmentProgress.completed / segmentProgress.total) * 55 + 35;
        return { step: 2, progress: Math.min(realPct, 90) };
      }
      return { step: 2, progress: Math.min(35 + elapsedMs / 300_000 * 55, 90) };
    }
    case "completed":
      return { step: 4, progress: 100 };
    case "failed":
      return { step: -1, progress: 0 };
    default:
      return { step: 0, progress: 5 };
  }
}

/* -------------------------------------------------------------------------- */
/*  Main page component                                                       */
/* -------------------------------------------------------------------------- */

export default function GenerationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const wizard = useGenerationWizardStore();
  const generationId = params.id as string;
  const watchedGen = useWatchedGenerationsStore(
    (s) => s.generations.find((g) => g.id === generationId),
  );

  // Stale timeout state - must be declared before useGenerationStatus so it can be passed in
  const pageOpenedAt = useRef(Date.now());
  const [isStale, setIsStale] = useState(false);

  // NanoBananaLoader elapsed time tracking
  const renderStartedAt = useRef(Date.now());
  const [renderElapsed, setRenderElapsed] = useState(0);

  const {
    data: gen,
    isLoading,
    error,
    refetch,
  } = useGenerationStatus(generationId, isStale);
  const regenerateSegment = useRegenerateSegment();
  const approveAndGenerate = useApproveAndGenerate();

  const { data: creditInfo } = useCredits();
  const hasCredits = (creditInfo?.remaining ?? 0) > 0;

  // Script collapsible state
  const [scriptExpanded, setScriptExpanded] = useState(true);

  // Product and persona names for header subtitle (#154)
  const [productName, setProductName] = useState<string | null>(null);
  const [personaName, setPersonaName] = useState<string | null>(null);

  // Inline approval state (#150)
  const [isApprovingInline, setIsApprovingInline] = useState(false);

  // Combination builder selection
  const [selectedHook, setSelectedHook] = useState(0);
  const [selectedBody, setSelectedBody] = useState(0);
  const [selectedCta, setSelectedCta] = useState(0);
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);

  // ZIP download (Story A)
  const {
    downloadZip,
    status: zipStatus,
    fetchedCount,
    totalCount: zipTotal,
    isActive: isZipping,
  } = useZipDownload();

  // Batch export mode (Story C)
  const [batchMode, setBatchMode] = useState(false);
  const [comboBannerDismissed, setComboBannerDismissed] = useState(false);
  const [selectedHooks, setSelectedHooks] = useState<Set<number>>(new Set([0]));
  const [selectedBodies, setSelectedBodies] = useState<Set<number>>(new Set([0]));
  const [selectedCtas, setSelectedCtas] = useState<Set<number>>(new Set([0]));

  const { batchStitch, status: batchStatus, progress: batchProgress, currentLabel: batchCurrentLabel, error: batchError, isActive: isBatching } =
    useBatchStitcher();

  function toggleBatchSelection(
    set: Set<number>,
    setFn: React.Dispatch<React.SetStateAction<Set<number>>>,
    index: number,
  ) {
    const next = new Set(set);
    if (next.has(index)) {
      if (next.size > 1) next.delete(index); // keep at least one
    } else {
      next.add(index);
    }
    setFn(next);
  }

  function formatEstimatedTime(seconds: number): string {
    if (seconds < 60) return `~${seconds}s`;
    const mins = (seconds / 60).toFixed(1);
    return `~${mins} minutes`;
  }

  // Last checked timestamp (ref to avoid restarting the secondsAgo interval on every poll)
  const lastCheckedRef = useRef(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);

  const status = (gen?.status as GenerationStatus) ?? "pending";
  const config = statusConfig[status] ?? statusConfig.scripting;
  const isComplete = status === "completed";
  const isFailed = status === "failed";
  const isAwaitingApproval = status === "awaiting_approval";
  const isProcessing = !isComplete && !isFailed && !isAwaitingApproval;

  // Tick renderElapsed every second for NanoBananaLoader progress (stop once done/failed)
  useEffect(() => {
    if (isComplete || isFailed) return;
    const id = setInterval(() => {
      setRenderElapsed(Date.now() - renderStartedAt.current);
    }, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, isFailed]);

  const skeletonCount = gen?.mode === "triple" ? 9 : 3;

  const segments = gen?.segments ?? null;
  const script = gen?.script ?? null;
  const progress = gen?.progress;

  // Parse failed segment job keys into a Set for O(1) lookup
  // Job key format: "hook_1", "hook_2", "body_1", "cta_3" etc.
  const failedSegmentKeys = useMemo(
    () => new Set(segments?.failed ?? []),
    [segments?.failed]
  );

  // Compute loader info from status and elapsed time (with real segment progress when available)
  const loaderInfo = statusToLoader(status, renderElapsed, progress);

  const combosToExport = useMemo(() => {
    if (!batchMode || !segments) return [];
    const combos: Array<{ hookUrl: string; bodyUrl: string; ctaUrl: string; label: string }> = [];
    for (const h of selectedHooks) {
      for (const b of selectedBodies) {
        for (const c of selectedCtas) {
          const hookVideo = segments.hooks?.[h];
          const bodyVideo = segments.bodies?.[b];
          const ctaVideo = segments.ctas?.[c];
          if (hookVideo && bodyVideo && ctaVideo
              && !failedSegmentKeys.has(`hook_${h + 1}`)
              && !failedSegmentKeys.has(`body_${b + 1}`)
              && !failedSegmentKeys.has(`cta_${c + 1}`)) {
            combos.push({
              hookUrl: hookVideo.url,
              bodyUrl: bodyVideo.url,
              ctaUrl: ctaVideo.url,
              label: `hook${h + 1}-body${b + 1}-cta${c + 1}`,
            });
          }
        }
      }
    }
    return combos;
  }, [batchMode, selectedHooks, selectedBodies, selectedCtas, segments, failedSegmentKeys]);

  const allSegmentEntries = useMemo(() => [
    ...(segments?.hooks ?? []).map((v, i) => ({ name: `hooks/hook_${i + 1}.mp4`, url: v.url })),
    ...(segments?.bodies ?? []).map((v, i) => ({ name: `bodies/body_${i + 1}.mp4`, url: v.url })),
    ...(segments?.ctas ?? []).map((v, i) => ({ name: `ctas/cta_${i + 1}.mp4`, url: v.url })),
  ], [segments]);

  // Triple-mode combo navigator (#146)
  const allCombos = useMemo(() => {
    if (gen?.mode !== "triple") return [];
    const combos: Array<{ hookIdx: number; bodyIdx: number; ctaIdx: number }> = [];
    const hooksCount = segments?.hooks?.length ?? 0;
    const bodiesCount = segments?.bodies?.length ?? 0;
    const ctasCount = segments?.ctas?.length ?? 0;
    for (let h = 0; h < hooksCount; h++) {
      for (let b = 0; b < bodiesCount; b++) {
        for (let c = 0; c < ctasCount; c++) {
          combos.push({ hookIdx: h, bodyIdx: b, ctaIdx: c });
        }
      }
    }
    return combos; // up to 27 combos depending on available segments
  }, [gen?.mode, segments]);

  const currentComboIndex = useMemo(() => {
    if (allCombos.length === 0) return -1;
    return allCombos.findIndex(
      (c) => c.hookIdx === selectedHook && c.bodyIdx === selectedBody && c.ctaIdx === selectedCta
    );
  }, [allCombos, selectedHook, selectedBody, selectedCta]);

  const goToCombo = useCallback((idx: number) => {
    const combo = allCombos[idx];
    if (!combo) return;
    setSelectedHook(combo.hookIdx);
    setSelectedBody(combo.bodyIdx);
    setSelectedCta(combo.ctaIdx);
  }, [allCombos]);

  // Collapse script when videos are ready
  useEffect(() => {
    if (isComplete && segments) {
      setScriptExpanded(false);
      const firstVideoKey = "cinerads-first-video-done";
      const isFirst = !localStorage.getItem(firstVideoKey);
      if (isFirst) localStorage.setItem(firstVideoKey, "1");
      trackVideoCompleted(gen?.mode ?? "unknown", isFirst);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, segments]);

  // Track failed generations
  useEffect(() => {
    if (isFailed) {
      trackVideoFailed(gen?.mode ?? "unknown");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFailed]);

  // One-time fetch of product + persona names for header subtitle (#154)
  useEffect(() => {
    if (!generationId || productName !== null) return;
    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      supabase
        .from("generations")
        .select("products(name), personas(name)")
        .eq("id", generationId)
        .maybeSingle()
        .then(({ data }: { data: { products: { name: string } | null; personas: { name: string } | null } | null }) => {
          if (data?.products?.name) setProductName(data.products.name);
          if (data?.personas?.name) setPersonaName(data.personas.name);
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationId]);

  // Update lastChecked ref whenever generation data refreshes (no re-render needed)
  useEffect(() => {
    if (gen) {
      lastCheckedRef.current = Date.now();
    }
  }, [gen]);

  // Tick secondsAgo every second while processing
  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastCheckedRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessing]);

  // Client-side stale timeout - after 12 minutes of non-terminal status, stop
  // polling and show a "taking longer than expected" card.
  useEffect(() => {
    if (!isProcessing || isStale) return;
    const TIMEOUT_MS = 12 * 60 * 1000;
    const elapsed = Date.now() - pageOpenedAt.current;
    const remaining = TIMEOUT_MS - elapsed;
    if (remaining <= 0) {
      setIsStale(true);
      return;
    }
    const timer = setTimeout(() => setIsStale(true), remaining);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessing]);

  // Warn user before closing tab during generation
  // Exclude awaiting_approval so the user can navigate away to approve without a warning
  const isGenerating = !!gen && !["completed", "failed", "awaiting_approval"].includes(status);
  useEffect(() => {
    if (!isGenerating) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isGenerating]);

  // Toast on ZIP download failure (Story A)
  useEffect(() => {
    if (zipStatus === "error") {
      toast.error("ZIP download failed. Check your connection and try again.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zipStatus]);

  /* ----- Download all segments as ZIP (Story A) ----- */
  function handleDownloadAll() {
    if (!segments || isZipping) return;
    trackVideoDownloaded("all_segments");
    const entries = [
      ...(segments.hooks ?? []).map((v, i) => ({ name: `hooks/hook_${i + 1}.mp4`, url: v.url })),
      ...(segments.bodies ?? []).map((v, i) => ({ name: `bodies/body_${i + 1}.mp4`, url: v.url })),
      ...(segments.ctas ?? []).map((v, i) => ({ name: `ctas/cta_${i + 1}.mp4`, url: v.url })),
    ];
    downloadZip(entries, `cinerades-${generationId.slice(0, 8)}-segments.zip`);
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
        sanitizeMsg(err instanceof Error ? err.message : "Failed to regenerate segment."),
      );
    } finally {
      setRegeneratingKey(null);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Inline approval handler (#150)                                        */
  /* ---------------------------------------------------------------------- */

  async function handleApproveInline() {
    if (isApprovingInline || approveAndGenerate.isPending) return;
    setIsApprovingInline(true);
    try {
      await approveAndGenerate.mutateAsync({ generation_id: generationId });
      toast.success("Approved! Generating your video...");
      refetch();
    } catch (err) {
      toast.error(
        sanitizeMsg(err instanceof Error ? err.message : "Failed to approve script."),
      );
    } finally {
      setIsApprovingInline(false);
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
            {sanitizeMsg(error.message || "Failed to load generation status.")}
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
            {productName && personaName ? `${productName} × ${personaName}` : `ID: ${generationId.slice(0, 8)}...`}
          </p>
        </div>
        {isAwaitingApproval && (
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-400">
            <FileText className="size-3" />
            Review Script
          </Badge>
        )}
        {isProcessing && !isStale && (
          <Badge variant="secondary" className={config.badgeClass}>
            <Loader2 className="size-3 animate-spin" />
            {config.label}
          </Badge>
        )}
        {isProcessing && isStale && (
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-400">
            <Clock className="size-3" />
            Taking longer...
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
      {/*  Don't close warning banner during generation                    */}
      {/* ---------------------------------------------------------------- */}
      {isGenerating && !isStale && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-amber-400" />
          <p className="text-sm text-amber-400">
            Video is generating. Please don&apos;t close this page.
          </p>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/*  Awaiting approval — inline script review + approval (#150)     */}
      {/* ---------------------------------------------------------------- */}
      {isAwaitingApproval && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/10">
                <FileText className="size-5 text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-foreground">Review Your Script</CardTitle>
                <CardDescription className="mt-0.5">
                  Approve to start video generation, or go back to regenerate. No credits have been charged yet.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Script segments */}
            {script && (
              <div className="grid gap-4 md:grid-cols-3">
                {/* Hooks */}
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Hooks ({script.hooks?.length ?? 0})
                  </h3>
                  {script.hooks?.map((seg, i) => (
                    <ScriptSegmentCard key={i} segment={seg} type={`Hook ${i + 1}`} />
                  ))}
                  {(!script.hooks || script.hooks.length === 0) && (
                    <p className="py-2 text-xs text-muted-foreground">No hook variants.</p>
                  )}
                </div>
                {/* Bodies */}
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Bodies ({script.bodies?.length ?? 0})
                  </h3>
                  {script.bodies?.map((seg, i) => (
                    <ScriptSegmentCard key={i} segment={seg} type={`Body ${i + 1}`} />
                  ))}
                  {(!script.bodies || script.bodies.length === 0) && (
                    <p className="py-2 text-xs text-muted-foreground">No body variants.</p>
                  )}
                </div>
                {/* CTAs */}
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    CTAs ({script.ctas?.length ?? 0})
                  </h3>
                  {script.ctas?.map((seg, i) => (
                    <ScriptSegmentCard key={i} segment={seg} type={`CTA ${i + 1}`} />
                  ))}
                  {(!script.ctas || script.ctas.length === 0) && (
                    <p className="py-2 text-xs text-muted-foreground">No CTA variants.</p>
                  )}
                </div>
              </div>
            )}
            {/* Action buttons */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                className="flex-1"
                onClick={handleApproveInline}
                disabled={isApprovingInline || approveAndGenerate.isPending}
              >
                {isApprovingInline || approveAndGenerate.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Starting generation...
                  </>
                ) : (
                  <>
                    <Zap className="size-4" />
                    Approve &amp; Generate
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/generate")}
              >
                <RotateCcw className="size-4" />
                Regenerate Script
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/*  Stale timeout card (replaces progress + productive wait)        */}
      {/* ---------------------------------------------------------------- */}
      {isProcessing && isStale && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-col gap-4 py-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/10">
                <Clock className="size-5 text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  Taking longer than expected
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  The video provider may be under high load. Your credits are safe. Check back in a few minutes.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsStale(false);
                  pageOpenedAt.current = Date.now();
                  refetch();
                }}
              >
                <RefreshCw className="size-4" />
                Check again
              </Button>
              <Button asChild variant="ghost">
                <Link href="/generate">Start new generation</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/*  Engaging generation loading screen                               */}
      {/* ---------------------------------------------------------------- */}
      {isProcessing && !isStale && (
        <NanoBananaLoader
          title="Generating Your Video"
          subtitle="Your video is rendering, usually 3-10 minutes"
          steps={RENDER_STEPS}
          currentStep={loaderInfo.step}
          progress={loaderInfo.progress}
          className="min-h-[400px]"
        />
      )}

      {/* ---------------------------------------------------------------- */}
      {/*  Error Message (non-fatal during processing)                      */}
      {/* ---------------------------------------------------------------- */}
      {gen?.error_message && !isFailed && (
        <Card className="border-amber-500/30">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="size-5 shrink-0 text-amber-400" />
            <p className="text-sm text-amber-400">{sanitizeMsg(gen.error_message)}</p>
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/*  POV Composite Image (shown during processing only)               */}
      {/* ---------------------------------------------------------------- */}
      {!isComplete && gen?.composite_image_url && (
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">
              POV Composite Image
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-[9/16] w-full max-w-xs overflow-hidden rounded-lg bg-muted">
              <img
                src={gen.composite_image_url}
                alt="POV composite"
                className="size-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/*  Script preview (collapsible, shown during processing only)       */}
      {/* ---------------------------------------------------------------- */}
      {!isComplete && script && (
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
      {/*  Skeleton segment cards (only shown during stale/long wait)       */}
      {/* ---------------------------------------------------------------- */}
      {isProcessing && isStale && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Video Segments
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="aspect-video w-full rounded-lg" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/*  Segment grid (shown when completed)                              */}
      {/* ---------------------------------------------------------------- */}
      {isComplete && segments && (
        <>
          {/* ============================================================ */}
          {/*  Full Ad Preview — auto-stitched on load                      */}
          {/* ============================================================ */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-foreground">
                    Full Ad Preview
                  </CardTitle>
                  <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                    Hook + Body + CTA
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    Hook {selectedHook + 1} + Body {selectedBody + 1} + CTA {selectedCta + 1}
                  </p>
                  {gen?.mode === "triple" && allCombos.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0"
                        disabled={currentComboIndex === -1}
                        onClick={() => goToCombo((currentComboIndex - 1 + allCombos.length) % allCombos.length)}
                        aria-label="Previous combination"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {currentComboIndex === -1 ? `? / ${allCombos.length}` : `${currentComboIndex + 1} / ${allCombos.length}`}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0"
                        disabled={currentComboIndex === -1}
                        onClick={() => goToCombo((currentComboIndex + 1) % allCombos.length)}
                        aria-label="Next combination"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CombinationPreview
                hookVideo={segments.hooks?.[selectedHook]}
                bodyVideo={segments.bodies?.[selectedBody]}
                ctaVideo={segments.ctas?.[selectedCta]}
                generationId={generationId}
                allSegmentEntries={allSegmentEntries}
                hookScript={script?.hooks?.[selectedHook]}
                bodyScript={script?.bodies?.[selectedBody]}
                ctaScript={script?.ctas?.[selectedCta]}
                autoStitch={true}
              />
            </CardContent>
          </Card>

          <Separator />

          {/* Download all + Batch Export toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Video Segments
              </h2>
              <p className="text-xs text-muted-foreground">
                Regenerate any single segment for 1 credit.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={batchMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  const entering = !batchMode;
                  setBatchMode(entering);
                  if (entering && segments) {
                    setSelectedHooks(new Set((segments.hooks ?? []).map((_, i) => i)));
                    setSelectedBodies(new Set((segments.bodies ?? []).map((_, i) => i)));
                    setSelectedCtas(new Set((segments.ctas ?? []).map((_, i) => i)));
                  }
                }}
              >
                <Layers className="size-4" />
                Batch Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadAll}
                disabled={isZipping}
              >
                {isZipping ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {zipStatus === "fetching"
                      ? `Fetching… ${fetchedCount}/${zipTotal}`
                      : "Zipping…"}
                  </>
                ) : (
                  <>
                    <Download className="size-4" />
                    {zipStatus === "done" ? "Downloaded ✓" : "Download All Segments"}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Partial failure warning banner */}
          {segments?.failed && segments.failed.length > 0 && status === "completed" && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {segments.failed.length} segment{segments.failed.length > 1 ? "s" : ""} failed to generate
                </p>
                <p className="text-amber-700 dark:text-amber-300">
                  Credits for those segments have been refunded. The remaining combinations are still available.
                </p>
              </div>
            </div>
          )}

          {/* Combination Discovery Banner (triple mode, #145) */}
          {gen?.mode === "triple" && status === "completed" && !batchMode && !comboBannerDismissed && (
            <div className="flex items-start justify-between gap-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 mb-2">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-primary">You have {allCombos.length} possible combinations</p>
                <p className="text-xs text-muted-foreground">Select segments in each column to preview and export custom video combinations.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={() => {
                    setBatchMode(true);
                    setComboBannerDismissed(true);
                  }}
                >
                  Build Combinations
                </Button>
                <button
                  type="button"
                  aria-label="Dismiss"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setComboBannerDismissed(true)}
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-3">
            {/* Hooks column */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">Hooks</h3>
                {batchMode && (segments?.hooks?.length ?? 0) > 1 && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      const all = (segments?.hooks ?? []).map((_, i) => i);
                      setSelectedHooks(selectedHooks.size === all.length ? new Set([all[0]]) : new Set(all));
                    }}
                  >
                    {selectedHooks.size === (segments?.hooks?.length ?? 0) ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>
              {segments.hooks?.map((video, i) => (
                failedSegmentKeys.has(`hook_${i + 1}`) ? (
                  <div key={i} className="flex items-center justify-center rounded-xl border border-dashed border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
                    <p className="text-xs text-red-500">Hook {i + 1} failed</p>
                  </div>
                ) : (
                  <VideoSegmentCard
                    key={i}
                    video={video}
                    label={`Hook ${i + 1}`}
                    scriptText={script?.hooks?.[i]?.text}
                    isSelected={batchMode ? selectedHooks.has(i) : selectedHook === i}
                    onSelect={() => {
                      if (batchMode) {
                        toggleBatchSelection(selectedHooks, setSelectedHooks, i);
                      }
                      setSelectedHook(i);
                    }}
                    onRegenerate={() => handleRegenerateSegment("hook", i + 1)}
                    isRegenerating={regeneratingKey === `hook_${i + 1}`}
                    multiSelect={batchMode}
                    regenRemaining={hasCredits ? (creditInfo?.remaining ?? 0) : 0}
                  />
                )
              ))}
              {(!segments.hooks || segments.hooks.length === 0) && (
                <div className="flex aspect-[9/16] w-full items-center justify-center rounded-xl border border-dashed border-border">
                  <p className="text-sm text-muted-foreground">
                    No hook segments
                  </p>
                </div>
              )}
            </div>

            {/* Bodies column */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">Bodies</h3>
                {batchMode && (segments?.bodies?.length ?? 0) > 1 && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      const all = (segments?.bodies ?? []).map((_, i) => i);
                      setSelectedBodies(selectedBodies.size === all.length ? new Set([all[0]]) : new Set(all));
                    }}
                  >
                    {selectedBodies.size === (segments?.bodies?.length ?? 0) ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>
              {segments.bodies?.map((video, i) => (
                failedSegmentKeys.has(`body_${i + 1}`) ? (
                  <div key={i} className="flex items-center justify-center rounded-xl border border-dashed border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
                    <p className="text-xs text-red-500">Body {i + 1} failed</p>
                  </div>
                ) : (
                  <VideoSegmentCard
                    key={i}
                    video={video}
                    label={`Body ${i + 1}`}
                    scriptText={script?.bodies?.[i]?.text}
                    isSelected={batchMode ? selectedBodies.has(i) : selectedBody === i}
                    onSelect={() => {
                      if (batchMode) {
                        toggleBatchSelection(selectedBodies, setSelectedBodies, i);
                      }
                      setSelectedBody(i);
                    }}
                    onRegenerate={() => handleRegenerateSegment("body", i + 1)}
                    isRegenerating={regeneratingKey === `body_${i + 1}`}
                    multiSelect={batchMode}
                    regenRemaining={hasCredits ? (creditInfo?.remaining ?? 0) : 0}
                  />
                )
              ))}
              {(!segments.bodies || segments.bodies.length === 0) && (
                <div className="flex aspect-[9/16] w-full items-center justify-center rounded-xl border border-dashed border-border">
                  <p className="text-sm text-muted-foreground">
                    No body segments
                  </p>
                </div>
              )}
            </div>

            {/* CTAs column */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">CTAs</h3>
                {batchMode && (segments?.ctas?.length ?? 0) > 1 && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      const all = (segments?.ctas ?? []).map((_, i) => i);
                      setSelectedCtas(selectedCtas.size === all.length ? new Set([all[0]]) : new Set(all));
                    }}
                  >
                    {selectedCtas.size === (segments?.ctas?.length ?? 0) ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>
              {segments.ctas?.map((video, i) => (
                failedSegmentKeys.has(`cta_${i + 1}`) ? (
                  <div key={i} className="flex items-center justify-center rounded-xl border border-dashed border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
                    <p className="text-xs text-red-500">CTA {i + 1} failed</p>
                  </div>
                ) : (
                  <VideoSegmentCard
                    key={i}
                    video={video}
                    label={`CTA ${i + 1}`}
                    scriptText={script?.ctas?.[i]?.text}
                    isSelected={batchMode ? selectedCtas.has(i) : selectedCta === i}
                    onSelect={() => {
                      if (batchMode) {
                        toggleBatchSelection(selectedCtas, setSelectedCtas, i);
                      }
                      setSelectedCta(i);
                    }}
                    onRegenerate={() => handleRegenerateSegment("cta", i + 1)}
                    isRegenerating={regeneratingKey === `cta_${i + 1}`}
                    multiSelect={batchMode}
                    regenRemaining={hasCredits ? (creditInfo?.remaining ?? 0) : 0}
                  />
                )
              ))}
              {(!segments.ctas || segments.ctas.length === 0) && (
                <div className="flex aspect-[9/16] w-full items-center justify-center rounded-xl border border-dashed border-border">
                  <p className="text-sm text-muted-foreground">
                    No CTA segments
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* -------------------------------------------------------------- */}
          {/*  Batch Export Panel (Story C)                                   */}
          {/* -------------------------------------------------------------- */}
          {batchMode && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Batch Export</p>
                    {combosToExport.length > 0 ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {selectedHooks.size} hook{selectedHooks.size !== 1 ? "s" : ""} ×{" "}
                          {selectedBodies.size} bod{selectedBodies.size !== 1 ? "ies" : "y"} ×{" "}
                          {selectedCtas.size} CTA{selectedCtas.size !== 1 ? "s" : ""} ={" "}
                          <span className="font-medium text-foreground">{combosToExport.length} combinations</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Estimated time: {formatEstimatedTime(combosToExport.length * 25)}
                          {combosToExport.length > 125 ? (
                            <span className="ml-1 text-red-400">
                              Max 125 combinations
                            </span>
                          ) : combosToExport.length > 27 && (
                            <span className="ml-1 text-amber-400">
                              Large export, stay on this tab
                            </span>
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Select segments above to build combinations</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBatchMode(false)}
                      disabled={isBatching}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => batchStitch(combosToExport, generationId)}
                      disabled={combosToExport.length === 0 || isBatching || combosToExport.length > 125}
                    >
                      {isBatching ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          {batchStatus === "zipping"
                            ? "Zipping…"
                            : `Stitching ${batchProgress.current}/${batchProgress.total}…`}
                        </>
                      ) : batchStatus === "done" ? (
                        <>
                          <Check className="size-3.5" />
                          Exported ✓
                        </>
                      ) : (
                        <>
                          <Layers className="size-3.5" />
                          {combosToExport.length > 0
                            ? `Export ${combosToExport.length} Combo${combosToExport.length !== 1 ? "s" : ""} →`
                            : "Export →"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Progress bar */}
                {isBatching && batchStatus === "stitching" && batchProgress.total > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Stitching {batchProgress.current}/{batchProgress.total}
                      {batchCurrentLabel && `: ${batchCurrentLabel}`}
                    </p>
                  </div>
                )}

                {batchError && (
                  <p className="text-xs text-red-400">{batchError}</p>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/*  3. Composite Image + Generated Script - combined card        */}
          {/* ============================================================ */}
          {(gen?.composite_image_url || script) && (
            <Card>
              <CardHeader>
                <button
                  type="button"
                  onClick={() => setScriptExpanded(!scriptExpanded)}
                  className="flex w-full items-center justify-between"
                >
                  <CardTitle className="text-foreground">
                    Reference Materials
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
                  <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
                    {/* Composite image (left) */}
                    {gen?.composite_image_url && (
                      <div className="shrink-0">
                        <h4 className="mb-2 text-sm font-semibold text-foreground">
                          POV Composite Image
                        </h4>
                        <div className="aspect-[9/16] w-full max-w-[200px] overflow-hidden rounded-lg bg-muted">
                          <img
                            src={gen.composite_image_url}
                            alt="POV composite"
                            className="size-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      </div>
                    )}

                    {/* Script (right) */}
                    {script && (
                      <div className="flex-1">
                        <h4 className="mb-3 text-sm font-semibold text-foreground">
                          Generated Script
                        </h4>
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="flex flex-col gap-2">
                            <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Hooks ({script.hooks?.length ?? 0})
                            </h5>
                            {script.hooks?.map((seg, i) => (
                              <ScriptSegmentCard key={i} segment={seg} type={`Hook ${i + 1}`} />
                            ))}
                          </div>
                          <div className="flex flex-col gap-2">
                            <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Bodies ({script.bodies?.length ?? 0})
                            </h5>
                            {script.bodies?.map((seg, i) => (
                              <ScriptSegmentCard key={i} segment={seg} type={`Body ${i + 1}`} />
                            ))}
                          </div>
                          <div className="flex flex-col gap-2">
                            <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              CTAs ({script.ctas?.length ?? 0})
                            </h5>
                            {script.ctas?.map((seg, i) => (
                              <ScriptSegmentCard key={i} segment={seg} type={`CTA ${i + 1}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* ============================================================ */}
          {/*  What's next? CTA                                             */}
          {/* ============================================================ */}
          {gen?.status === "completed" && (
            <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-sm font-medium">Your video is ready!</p>
              <p className="text-xs text-muted-foreground">Generate more combos or start a fresh campaign.</p>
              <Button
                size="sm"
                onClick={() => {
                  wizard.reset();
                  router.push("/generate");
                }}
              >
                Generate Another Video
              </Button>
            </div>
          )}
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
                  {gen?.error_message
                    ? sanitizeMsg(gen.error_message)
                    : "An error occurred during generation. Please try again."}
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
