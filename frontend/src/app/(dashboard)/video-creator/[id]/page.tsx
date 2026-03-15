"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  Clock,
  Download,
  Video,
  Plus,
  ChevronDown,
  ChevronUp,
  Film,
  Info,
  RefreshCw,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Loader2, Scissors, Monitor, Upload } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useSingleVideoStatus } from "@/hooks/use-single-video";
import { useGeneration } from "@/hooks/use-generations";
import { useVideoCreatorStore } from "@/stores/video-creator-store";
import { NanoBananaLoader } from "@/components/ui/nano-loader";
import { ScreenRecordingUpload } from "@/components/screen-recording-upload";
import { useUser } from "@clerk/nextjs";

/* -------------------------------------------------------------------------- */
/*  Loading skeleton                                                          */
/* -------------------------------------------------------------------------- */

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
      <Skeleton className="mx-auto aspect-[9/16] w-full max-w-sm rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Generating state screen                                                   */
/* -------------------------------------------------------------------------- */

const GENERATING_STEPS = [
  { label: "Submitting to Sora" },
  { label: "Generating video frames" },
  { label: "Rendering final video" },
  { label: "Processing output" },
];

function GeneratingScreen({
  progress,
  soraModel,
  duration,
}: {
  progress: number;
  soraModel?: string | null;
  duration?: number | null;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Map progress (0-100) to step index
  const currentStep =
    progress >= 90
      ? 3
      : progress >= 50
        ? 2
        : progress >= 10
          ? 1
          : 0;

  const modelLabel =
    soraModel === "sora-2-pro" ? "Sora 2 Pro" : "Sora 2 Standard";
  const durationLabel = duration ? `${duration}s` : "12s";

  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="flex flex-col items-center gap-6">
        {/* Model + duration badges */}
        <div className="flex items-center gap-2">
          <Badge variant="accent" className="gap-1.5">
            <Film className="size-3" />
            {modelLabel}
          </Badge>
          <Badge variant="secondary" className="gap-1.5">
            <Clock className="size-3" />
            {durationLabel}
          </Badge>
        </div>

        {/* NanoBananaLoader HUD */}
        <NanoBananaLoader
          title="Generating your video..."
          subtitle="This may take a few minutes"
          steps={GENERATING_STEPS}
          currentStep={currentStep}
          progress={progress}
          progressLabel="Rendering"
        />

        {/* Elapsed time */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="size-3" />
            Running for{" "}
            {elapsed >= 60
              ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
              : `${elapsed}s`}
          </span>
          <span className="text-border">|</span>
          <span>Usually ready in 2-5 minutes</span>
        </div>

        {/* While you wait */}
        <div className="w-full max-w-sm space-y-2">
          <p className="text-center text-xs font-medium text-muted-foreground">
            While you wait
          </p>
          <div className="flex justify-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/generate">New UGC Ad</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/personas/new">New Persona</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Completed state screen                                                    */
/* -------------------------------------------------------------------------- */

function CompletedScreen({
  videoUrl,
  soraModel,
  duration,
  referenceType,
  prompt,
  createdAt,
  onCreateAnother,
}: {
  videoUrl: string;
  soraModel?: string | null;
  duration?: number | null;
  referenceType?: string | null;
  prompt?: string | null;
  createdAt?: string | null;
  onCreateAnother: () => void;
}) {
  const [scriptExpanded, setScriptExpanded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimmedUrl, setTrimmedUrl] = useState<string | null>(null);
  const [trimStatus, setTrimStatus] = useState("");

  // SaaS Demo Insert state
  const { user } = useUser();
  const store = useVideoCreatorStore();
  const [demoMode, setDemoMode] = useState(false);
  const [localScreenPath, setLocalScreenPath] = useState<string | null>(store.screenRecordingPath);
  const [insertStart, setInsertStart] = useState(store.demoInsertStartSec);
  const [insertEnd, setInsertEnd] = useState<number | null>(store.demoInsertEndSec);
  const [isDemoStitching, setIsDemoStitching] = useState(false);
  const [demoStitchStatus, setDemoStitchStatus] = useState("");
  const [demoStitchProgress, setDemoStitchProgress] = useState(0);
  const [demoStitchedUrl, setDemoStitchedUrl] = useState<string | null>(null);
  const videoDuration = duration ?? 12;

  const modelLabel =
    soraModel === "sora-2-pro" ? "Sora 2 Pro" : "Sora 2 Standard";
  const durationLabel = duration ? `${duration}s` : "12s";
  const refLabel =
    referenceType === "composite"
      ? "Composite"
      : referenceType === "persona"
        ? "Persona"
        : referenceType === "custom"
          ? "Custom Image"
          : "None";

  // Trim ALL silence (leading, trailing, AND internal dead air) using the same
  // pipeline as the Kling stitcher: silencedetect -30dB, find speech segments,
  // encode each with I-frame start, concat. Removes all pauses > 500ms.
  const handleTrimSilence = useCallback(async () => {
    setIsTrimming(true);
    setTrimStatus("Loading FFmpeg & trimming all silence...");
    try {
      const { trimSingleVideoToBlob } = await import("@/hooks/use-video-stitcher");
      const blob = await trimSingleVideoToBlob(videoUrl);
      const url = URL.createObjectURL(blob);
      setTrimmedUrl(url);
      toast.success("All silence removed — internal pauses trimmed!");
    } catch (err) {
      console.error("Trim failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to trim silence.");
    } finally {
      setIsTrimming(false);
      setTrimStatus("");
    }
  }, [videoUrl]);

  // Use trimmed version if available
  const activeVideoUrl = trimmedUrl ?? videoUrl;

  const handleDownload = useCallback(async () => {
    try {
      if (trimmedUrl) {
        // Trimmed version is already a blob URL — download directly
        const a = document.createElement("a");
        a.href = trimmedUrl;
        a.download = `cinerads-video-trimmed-${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const response = await fetch(videoUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cinerads-video-${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      toast.success("Video downloaded!");
    } catch {
      toast.error("Failed to download video. Please try again.");
    }
  }, [videoUrl, trimmedUrl]);

  // Handle demo insert stitch
  const handleDemoInsert = useCallback(async () => {
    if (!localScreenPath || !videoUrl) return;

    setIsDemoStitching(true);
    setDemoStitchProgress(0);
    setDemoStitchStatus("Loading editor…");

    try {
      const { demoInsertStitchToBlob } = await import("@/hooks/use-demo-insert-stitcher");
      setDemoStitchStatus("Processing…");
      const blob = await demoInsertStitchToBlob({
        videoUrl: activeVideoUrl,
        screenRecordingUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/screen-recordings/${localScreenPath}`,
        startSec: insertStart,
        endSec: insertEnd,
        format: "9:16",
      });
      const url = URL.createObjectURL(blob);
      setDemoStitchedUrl(url);
      toast.success("Demo inserted successfully!");
    } catch (err) {
      console.error("Demo insert failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to insert demo");
    } finally {
      setIsDemoStitching(false);
      setDemoStitchStatus("");
    }
  }, [activeVideoUrl, localScreenPath, insertStart, insertEnd]);

  // Use demo-inserted version if available, then trimmed, then original
  const finalVideoUrl = demoStitchedUrl ?? trimmedUrl ?? videoUrl;

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      {/* Video player */}
      <Card className="overflow-hidden border-0 bg-transparent shadow-none p-0">
        <div className="mx-auto w-full max-w-sm">
          <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              src={finalVideoUrl}
              controls
              autoPlay
              loop
              playsInline
              className="absolute inset-0 h-full w-full object-contain"
            />
          </div>
          {(trimmedUrl || demoStitchedUrl) && (
            <p className="text-center text-xs text-green-600 mt-2">
              {demoStitchedUrl ? "Demo inserted — playing edited version" : "Silence trimmed — playing edited version"}
            </p>
          )}
        </div>
      </Card>

      {/* Trim progress */}
      {isTrimming && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {trimStatus}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={handleDownload} size="lg" className="gap-2">
          <Download className="size-4" />
          {trimmedUrl ? "Download Trimmed" : "Download MP4"}
        </Button>
        <Button
          onClick={handleTrimSilence}
          size="lg"
          variant="secondary"
          className="gap-2"
          disabled={isTrimming}
        >
          {isTrimming ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Scissors className="size-4" />
          )}
          Trim Silence
        </Button>
        <Button
          onClick={onCreateAnother}
          size="lg"
          variant="outline"
          className="gap-2"
        >
          <Plus className="size-4" />
          Create Another
        </Button>
      </div>

      {/* SaaS Demo Insert */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor className="size-4 text-purple-400" />
              <CardTitle className="text-sm">SaaS Demo Insert</CardTitle>
              <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 text-[10px]">Beta</Badge>
            </div>
            <Switch
              checked={demoMode}
              onCheckedChange={(checked) => {
                setDemoMode(checked);
                if (!checked) {
                  setLocalScreenPath(null);
                  store.setScreenRecordingPath(null);
                  setDemoStitchedUrl(null);
                }
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Insert a screen recording of your app at a specific timestamp in the video.
          </p>
        </CardHeader>
        {demoMode && (
          <CardContent className="space-y-4 pt-0">
            {/* Screen recording upload */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Screen Recording</Label>
              <div className="mt-1.5">
                <ScreenRecordingUpload
                  userId={user?.id ?? ""}
                  storagePath={localScreenPath}
                  onUpload={(path) => {
                    setLocalScreenPath(path);
                    store.setScreenRecordingPath(path);
                  }}
                  onRemove={() => {
                    setLocalScreenPath(null);
                    store.setScreenRecordingPath(null);
                  }}
                  disabled={!user?.id}
                />
              </div>
            </div>

            {/* Time range controls */}
            {localScreenPath && (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs text-muted-foreground">Insert starts at</Label>
                    <span className="text-xs font-mono tabular-nums text-foreground">{insertStart.toFixed(1)}s</span>
                  </div>
                  <Slider
                    min={0}
                    max={videoDuration}
                    step={0.5}
                    value={[insertStart]}
                    onValueChange={([v]) => {
                      setInsertStart(v);
                      store.setDemoInsertStartSec(v);
                    }}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs text-muted-foreground">Insert ends at</Label>
                    <span className="text-xs font-mono tabular-nums text-foreground">
                      {insertEnd !== null ? `${insertEnd.toFixed(1)}s` : "End of video"}
                    </span>
                  </div>
                  <Slider
                    min={insertStart + 0.5}
                    max={videoDuration}
                    step={0.5}
                    value={[insertEnd ?? videoDuration]}
                    onValueChange={([v]) => {
                      const end = v >= videoDuration - 0.1 ? null : v;
                      setInsertEnd(end);
                      store.setDemoInsertEndSec(end);
                    }}
                  />
                </div>

                {/* Preview bar */}
                <div className="rounded-lg bg-muted/50 p-2">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                    <span>0s</span>
                    <span className="flex-1" />
                    <span>{videoDuration}s</span>
                  </div>
                  <div className="relative h-6 rounded bg-muted overflow-hidden">
                    {/* Original video portion */}
                    <div
                      className="absolute inset-y-0 left-0 bg-primary/30 rounded-l"
                      style={{ width: `${(insertStart / videoDuration) * 100}%` }}
                    />
                    {/* Demo insert portion */}
                    <div
                      className="absolute inset-y-0 bg-purple-500/50"
                      style={{
                        left: `${(insertStart / videoDuration) * 100}%`,
                        width: `${(((insertEnd ?? videoDuration) - insertStart) / videoDuration) * 100}%`,
                      }}
                    />
                    {/* Remaining original */}
                    {insertEnd !== null && (
                      <div
                        className="absolute inset-y-0 right-0 bg-primary/30 rounded-r"
                        style={{ width: `${((videoDuration - insertEnd) / videoDuration) * 100}%` }}
                      />
                    )}
                    {/* Labels */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[9px] font-medium text-foreground/70">
                        Hook ({insertStart}s) → Demo ({((insertEnd ?? videoDuration) - insertStart).toFixed(1)}s)
                        {insertEnd !== null && ` → CTA (${(videoDuration - insertEnd).toFixed(1)}s)`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stitch button */}
                <Button
                  onClick={handleDemoInsert}
                  disabled={isDemoStitching || !localScreenPath}
                  className="w-full gap-2"
                  variant="default"
                >
                  {isDemoStitching ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {demoStitchStatus}
                    </>
                  ) : (
                    <>
                      <Monitor className="size-4" />
                      Insert Demo Recording
                    </>
                  )}
                </Button>

                {isDemoStitching && (
                  <Progress value={demoStitchProgress} className="h-1.5" />
                )}

                {demoStitchedUrl && (
                  <Button
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = demoStitchedUrl;
                      a.download = `cinerads-demo-insert-${Date.now()}.mp4`;
                      a.click();
                    }}
                    variant="outline"
                    className="w-full gap-2"
                  >
                    <Download className="size-4" />
                    Download Demo Version
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Metadata card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Generation Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Model</p>
              <Badge variant="accent" className="gap-1">
                <Film className="size-3" />
                {modelLabel}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Duration</p>
              <Badge variant="secondary" className="gap-1">
                <Clock className="size-3" />
                {durationLabel}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Reference</p>
              <Badge variant="secondary">{refLabel}</Badge>
            </div>
            {createdAt && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm text-foreground">
                  {formatDate(createdAt)}
                </p>
              </div>
            )}
          </div>

          {/* Prompt / Script (collapsible) */}
          {prompt && (
            <>
              <Separator />
              <Collapsible
                open={scriptExpanded}
                onOpenChange={setScriptExpanded}
              >
                <CollapsibleTrigger asChild>
                  <button className="flex w-full items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <span className="flex items-center gap-1.5">
                      <Info className="size-3.5" />
                      Script / Prompt
                    </span>
                    {scriptExpanded ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                      {prompt}
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Failed state screen                                                       */
/* -------------------------------------------------------------------------- */

function FailedScreen({
  errorMessage,
  onTryAgain,
}: {
  errorMessage?: string | null;
  onTryAgain: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg py-16">
      <Card>
        <CardContent className="flex flex-col items-center gap-6 py-8">
          {/* Error icon */}
          <div className="flex size-16 items-center justify-center rounded-full bg-red-500/10">
            <AlertCircle className="size-8 text-red-500" />
          </div>

          {/* Heading */}
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-semibold text-foreground">
              Video Generation Failed
            </h2>
            {errorMessage && (
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
            )}
          </div>

          {/* Refund notice */}
          <Alert>
            <CreditCard className="size-4" />
            <AlertTitle>Credits Refunded</AlertTitle>
            <AlertDescription>
              Your credits have been refunded to your account. You can try
              generating again at no extra cost.
            </AlertDescription>
          </Alert>

          {/* Try again */}
          <Button onClick={onTryAgain} size="lg" className="gap-2">
            <RefreshCw className="size-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Not found screen                                                          */
/* -------------------------------------------------------------------------- */

function NotFoundScreen() {
  return (
    <div className="mx-auto max-w-lg py-16">
      <Card>
        <CardContent className="flex flex-col items-center gap-6 py-8">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <Video className="size-8 text-muted-foreground" />
          </div>
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-semibold text-foreground">
              Generation Not Found
            </h2>
            <p className="text-sm text-muted-foreground">
              This generation doesn&apos;t exist or you don&apos;t have access
              to it.
            </p>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/video-creator">
              <ArrowLeft className="size-4" />
              Back to Video Creator
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main page component                                                       */
/* -------------------------------------------------------------------------- */

export default function VideoCreatorResultPage() {
  const params = useParams();
  const router = useRouter();
  const store = useVideoCreatorStore();
  const generationId = params.id as string;

  // Poll single-video status (auto-refetches every 5s while processing)
  const {
    data: statusData,
    isLoading: statusLoading,
    error: statusError,
  } = useSingleVideoStatus(generationId);

  // Load generation record for metadata
  const {
    data: generation,
  } = useGeneration(generationId);

  // Determine overall loading state
  const isLoading = statusLoading && !statusData;

  // Extract status info
  const status = statusData?.status ?? null;
  const progress = statusData?.progress ?? 0;
  const videoUrl = statusData?.video_url ?? null;
  const errorMessage = statusData?.error_message ?? null;

  // Extract generation metadata
  const soraModel = generation?.sora_model ?? store.soraModel;
  const duration = generation?.duration ?? store.duration;
  const referenceType = generation?.reference_type ?? store.referenceType;
  const createdAt = generation?.created_at ?? null;

  // Build the prompt string from generation data or store
  const prompt =
    generation?.freeform_prompt ??
    (store.freeformPrompt ||
      (generation?.script
        ? [
            generation.script.hooks?.[0]?.text,
            generation.script.bodies?.[0]?.text,
            generation.script.ctas?.[0]?.text,
          ]
            .filter(Boolean)
            .join("\n\n")
        : null));

  // Error toast for status polling failure
  useEffect(() => {
    if (statusError) {
      toast.error("Failed to load generation status. Please refresh.");
    }
  }, [statusError]);

  // Handle "Create Another"
  function handleCreateAnother() {
    store.reset();
    router.push("/video-creator");
  }

  // Handle "Try Again"
  function handleTryAgain() {
    store.reset();
    router.push("/video-creator");
  }

  /* ---- Render ---- */

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen px-4">
        <LoadingSkeleton />
      </div>
    );
  }

  // Not found only when status specifically fails (generation doesn't exist)
  if (statusError && !statusData) {
    return (
      <div className="min-h-screen px-4">
        <NotFoundScreen />
      </div>
    );
  }

  // Failed
  if (status === "failed") {
    return (
      <div className="min-h-screen px-4">
        {/* Back link */}
        <div className="mx-auto max-w-2xl pt-6">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link href="/video-creator">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
        </div>
        <FailedScreen
          errorMessage={errorMessage}
          onTryAgain={handleTryAgain}
        />
      </div>
    );
  }

  // Completed but video URL unavailable
  if (status === "completed" && !videoUrl) {
    return (
      <div className="min-h-screen px-4">
        <div className="mx-auto max-w-2xl pt-6">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link href="/video-creator">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
        </div>
        <FailedScreen errorMessage="Video completed but URL is unavailable. Please try again." onTryAgain={handleTryAgain} />
      </div>
    );
  }

  // Completed
  if (status === "completed" && videoUrl) {
    return (
      <div className="min-h-screen px-4">
        {/* Back link */}
        <div className="mx-auto max-w-2xl pt-6">
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link href="/video-creator">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
        </div>
        <CompletedScreen
          videoUrl={videoUrl}
          soraModel={soraModel}
          duration={duration}
          referenceType={referenceType}
          prompt={prompt}
          createdAt={createdAt}
          onCreateAnother={handleCreateAnother}
        />
      </div>
    );
  }

  // Generating (default — any non-terminal status)
  return (
    <div className="min-h-screen px-4">
      {/* Back link */}
      <div className="mx-auto max-w-2xl pt-6">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link href="/video-creator">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
      </div>
      <GeneratingScreen
        progress={progress}
        soraModel={soraModel}
        duration={duration}
      />
    </div>
  );
}
