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
import { Loader2, Scissors } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useSingleVideoStatus } from "@/hooks/use-single-video";
import { useGeneration } from "@/hooks/use-generations";
import { useVideoCreatorStore } from "@/stores/video-creator-store";
import { NanoBananaLoader } from "@/components/ui/nano-loader";

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

  // Trim silence from the video using FFmpeg WASM
  const handleTrimSilence = useCallback(async () => {
    setIsTrimming(true);
    setTrimStatus("Loading FFmpeg...");
    try {
      // Dynamic import to avoid loading FFmpeg WASM until needed
      const stitcherModule = await import("@/hooks/use-video-stitcher");
      const { fetchFile } = await import("@ffmpeg/util");
      const ffmpeg = await stitcherModule.getFFmpeg();

      setTrimStatus("Downloading video...");
      const videoData = await fetchFile(videoUrl);
      ffmpeg.writeFile("input.mp4", videoData);

      // Detect silence
      setTrimStatus("Detecting silence...");
      let logBuffer = "";
      const logHandler = ({ message }: { message: string }) => {
        logBuffer += message + "\n";
      };
      ffmpeg.on("log", logHandler);
      await ffmpeg.exec(["-i", "input.mp4", "-af", "silencedetect=n=-30dB:d=0.1", "-f", "null", "-"]);
      ffmpeg.off("log", logHandler);

      // Parse duration
      const durMatch = logBuffer.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
      const totalDuration = durMatch
        ? parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseInt(durMatch[3]) + parseInt(durMatch[4]) / 100
        : 0;

      if (totalDuration <= 0) {
        toast.error("Could not parse video duration");
        return;
      }

      // Parse silence regions
      const silenceStarts: number[] = [];
      const silenceEnds: number[] = [];
      for (const line of logBuffer.split("\n")) {
        const startMatch = line.match(/silence_start:\s*([\d.]+)/);
        if (startMatch) silenceStarts.push(parseFloat(startMatch[1]));
        const endMatch = line.match(/silence_end:\s*([\d.]+)/);
        if (endMatch) silenceEnds.push(parseFloat(endMatch[1]));
      }

      // Build trim bounds (remove leading + trailing silence)
      const BUFFER = 0.15;
      const MIN_SILENCE = 0.5;
      let speechStart = 0;
      let speechEnd = totalDuration;

      // Trim leading silence
      if (silenceStarts.length > 0 && silenceStarts[0] < 0.1) {
        speechStart = (silenceEnds[0] ?? 0) - BUFFER;
        if (speechStart < 0) speechStart = 0;
      }

      // Trim trailing silence
      if (silenceStarts.length > 0) {
        const lastStart = silenceStarts[silenceStarts.length - 1];
        if (totalDuration - lastStart < MIN_SILENCE + 0.5) {
          speechEnd = lastStart + BUFFER;
        }
      }

      const trimDuration = speechEnd - speechStart;
      if (trimDuration >= totalDuration - 0.3) {
        toast.info("No significant silence found to trim");
        return;
      }

      // Encode trimmed clip
      setTrimStatus("Trimming...");
      await ffmpeg.exec([
        "-i", "input.mp4",
        "-ss", String(speechStart),
        "-t", String(trimDuration),
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
        "-c:a", "aac", "-b:a", "128k",
        "trimmed.mp4",
      ]);

      const output = await ffmpeg.readFile("trimmed.mp4");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const trimmedBlob = new Blob([output as any], { type: "video/mp4" });
      const url = URL.createObjectURL(trimmedBlob);
      setTrimmedUrl(url);

      // Cleanup virtual FS
      try {
        await ffmpeg.deleteFile("input.mp4");
        await ffmpeg.deleteFile("trimmed.mp4");
      } catch { /* ignore cleanup errors */ }

      toast.success(`Trimmed! ${totalDuration.toFixed(1)}s -> ${trimDuration.toFixed(1)}s`);
    } catch (err) {
      console.error("Trim failed:", err);
      toast.error("Failed to trim silence. Try downloading the original.");
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

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      {/* Video player */}
      <Card className="overflow-hidden border-0 bg-transparent shadow-none p-0">
        <div className="mx-auto w-full max-w-sm">
          <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              src={activeVideoUrl}
              controls
              autoPlay
              loop
              playsInline
              className="absolute inset-0 h-full w-full object-contain"
            />
          </div>
          {trimmedUrl && (
            <p className="text-center text-xs text-green-600 mt-2">
              Silence trimmed — playing edited version
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
