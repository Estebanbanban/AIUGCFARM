"use client";

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { EmotionName, EmotionIntensity } from "@/types/database";

const EMOTIONS: { name: EmotionName; emoji: string; label: string }[] = [
  { name: "neutral", emoji: "😐", label: "Neutral" },
  { name: "happy", emoji: "😊", label: "Happy" },
  { name: "excited", emoji: "🤩", label: "Excited" },
  { name: "surprised", emoji: "😮", label: "Surprised" },
  { name: "serious", emoji: "😐", label: "Serious" },
];

interface EmotionPickerProps {
  emotion: EmotionName;
  intensity: EmotionIntensity;
  onChange: (emotion: EmotionName, intensity: EmotionIntensity) => void;
  disabled?: boolean;
}

export function EmotionPicker({ emotion, intensity, onChange, disabled }: EmotionPickerProps) {
  const showIntensity = emotion !== "neutral";

  const intensityLabel = intensity === 1 ? "Low" : intensity === 2 ? "Medium" : "High";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {EMOTIONS.map((e) => (
          <button
            key={e.name}
            type="button"
            disabled={disabled}
            onClick={() => onChange(e.name, intensity)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
              emotion === e.name
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-muted-foreground/50",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <span>{e.emoji}</span>
            {e.label}
          </button>
        ))}
      </div>

      {showIntensity && (
        <div className="flex items-center gap-3">
          <span className="w-16 text-xs text-muted-foreground">Intensity</span>
          <div className="flex flex-1 flex-col gap-1">
            <Slider
              min={1}
              max={3}
              step={1}
              value={[intensity]}
              onValueChange={([v]) => onChange(emotion, v as EmotionIntensity)}
              disabled={disabled}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
            </div>
          </div>
          <span className="w-14 text-right text-xs font-medium text-foreground">
            {intensityLabel}
          </span>
        </div>
      )}
    </div>
  );
}
