"use client";

import { useState } from "react";
import { Loader2, RefreshCw, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmotionPicker } from "./EmotionPicker";
import { useGenerateSegmentScript, useGenerateSegmentComposite } from "@/hooks/use-generations";
import type { AdvancedSegmentConfig, EmotionName, EmotionIntensity } from "@/types/database";

const SEGMENT_LABELS: Record<"hook" | "body" | "cta", string> = {
  hook: "Hook",
  body: "Body",
  cta: "CTA",
};

const EMOTION_BADGE_LABELS: Record<EmotionName, string> = {
  neutral: "😐 Neutral",
  happy: "😊 Happy",
  excited: "🤩 Excited",
  surprised: "😮 Surprised",
  serious: "😐 Serious",
};

interface AdvancedSegmentCardProps {
  segmentType: "hook" | "body" | "cta";
  variantIndex: number;
  segmentLabel: string;
  variantLabel?: string;
  config: AdvancedSegmentConfig;
  productId: string;
  personaId: string;
  format: "9:16" | "16:9";
  mainCompositeSignedUrl: string | null;
  onUpdate: (patch: Partial<AdvancedSegmentConfig>) => void;
}

export function AdvancedSegmentCard({
  segmentType,
  variantIndex,
  segmentLabel,
  variantLabel,
  config,
  productId,
  personaId,
  format,
  mainCompositeSignedUrl,
  onUpdate,
}: AdvancedSegmentCardProps) {
  const [customImagePrompt, setCustomImagePrompt] = useState("");
  const generateScript = useGenerateSegmentScript();
  const generateComposite = useGenerateSegmentComposite();

  const displayImageUrl = config.imageSignedUrl || mainCompositeSignedUrl;

  function handleEmotionChange(emotion: EmotionName, intensity: EmotionIntensity) {
    onUpdate({ globalEmotion: emotion, globalIntensity: intensity });
  }

  async function handleRegenerateScript() {
    try {
      const result = await generateScript.mutateAsync({
        product_id: productId,
        persona_id: personaId,
        segment_type: segmentType,
        variant_index: variantIndex,
      });
      onUpdate({ scriptText: result.text });
      toast.success("Script regenerated");
    } catch {
      toast.error("Failed to regenerate script");
    }
  }

  async function handleRegenerateImage() {
    onUpdate({ isRegeneratingImage: true });
    try {
      const result = await generateComposite.mutateAsync({
        product_id: productId,
        persona_id: personaId,
        format,
        custom_scene_prompt: customImagePrompt.trim() || undefined,
      });
      onUpdate({
        imagePath: result.image.path,
        imageSignedUrl: result.image.signed_url,
        isRegeneratingImage: false,
      });
      toast.success("Image regenerated");
    } catch {
      onUpdate({ isRegeneratingImage: false });
      toast.error("Failed to regenerate image");
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {segmentLabel}
            {variantLabel ? ` · ${variantLabel}` : ""}
          </span>
        </div>
        <Badge variant="outline" className="text-xs">
          {EMOTION_BADGE_LABELS[config.globalEmotion]}
        </Badge>
      </div>

      {/* Script textarea */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">
          Script
          <span className="ml-1 font-normal opacity-70">· use [e:emotion:intensity] for inline moments</span>
        </Label>
        <Textarea
          value={config.scriptText}
          onChange={(e) => onUpdate({ scriptText: e.target.value })}
          rows={3}
          placeholder={`Write the ${SEGMENT_LABELS[segmentType].toLowerCase()} script...`}
          className="resize-none text-sm"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerateScript}
          disabled={generateScript.isPending}
          className="w-fit"
        >
          {generateScript.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          AI Regenerate
        </Button>
      </div>

      {/* Emotion picker */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Emotion</Label>
        <EmotionPicker
          emotion={config.globalEmotion}
          intensity={config.globalIntensity}
          onChange={handleEmotionChange}
        />
      </div>

      {/* Action field */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Creator action (optional)</Label>
        <Input
          value={config.actionDescription}
          onChange={(e) => onUpdate({ actionDescription: e.target.value })}
          placeholder="e.g. hold product up, gesture toward camera"
          className="text-sm"
        />
      </div>

      {/* Image section */}
      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">Scene image</Label>
        <div
          className={`relative overflow-hidden rounded-lg bg-muted ${
            format === "9:16" ? "aspect-[9/16] max-w-[80px]" : "aspect-video max-w-[140px]"
          }`}
        >
          {displayImageUrl ? (
            <img
              src={displayImageUrl}
              alt="Segment scene"
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <ImageIcon className="size-4 text-muted-foreground" />
            </div>
          )}
          {config.isRegeneratingImage && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="size-4 animate-spin" />
            </div>
          )}
          {config.imagePath && (
            <div className="absolute bottom-1 left-1 rounded bg-primary/80 px-1 py-0.5 text-[9px] text-primary-foreground">
              custom
            </div>
          )}
        </div>
        <Input
          value={customImagePrompt}
          onChange={(e) => setCustomImagePrompt(e.target.value)}
          placeholder="Custom scene prompt (optional)"
          className="text-xs"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerateImage}
          disabled={config.isRegeneratingImage || generateComposite.isPending}
          className="w-fit"
        >
          {config.isRegeneratingImage ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          Regenerate Image
        </Button>
      </div>
    </div>
  );
}
