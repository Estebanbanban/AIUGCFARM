"use client";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSlideshowEditorStore } from "@/stores/slideshow-editor";

const MAX_HOOK_LENGTH = 200;
const MAX_TITLE_LENGTH = 120;
const MAX_SUBTITLE_LENGTH = 150;
const MAX_ACTION_LENGTH = 150;

export function SlideTextEditor() {
  const store = useSlideshowEditorStore();
  const selectedSlide = store.slides[store.selectedSlideIndex];

  if (!selectedSlide) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Select a slide to edit its text
      </div>
    );
  }

  if (selectedSlide.type === "hook") {
    return <HookTextEditor />;
  }

  return <BodyTextEditor />;
}

function HookTextEditor() {
  const store = useSlideshowEditorStore();
  const index = store.selectedSlideIndex;
  const slide = store.slides[index];
  const text = slide?.text ?? "";

  const handleChange = (value: string) => {
    const lower = value.toLowerCase();
    store.updateSlideText(index, lower);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Hook Text</Label>
        <CharCount current={text.length} max={MAX_HOOK_LENGTH} />
      </div>
      <Textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="e.g., 5 ways i finally stopped obsessing over my case interview"
        className="min-h-[80px] resize-none text-sm lowercase"
        maxLength={MAX_HOOK_LENGTH}
      />
    </div>
  );
}

function BodyTextEditor() {
  const store = useSlideshowEditorStore();
  const index = store.selectedSlideIndex;
  const slide = store.slides[index];
  const tc = slide?.textContent ?? { title: "", subtitle: "", action: "" };

  const update = (field: "title" | "subtitle" | "action", value: string) => {
    const lower = value.toLowerCase();
    store.updateSlideTextContent(index, { [field]: lower });
  };

  return (
    <div className="space-y-4">
      {/* Title in badge */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm bg-white border border-border" />
              Title (in badge)
            </span>
          </Label>
          <CharCount current={tc.title.length} max={MAX_TITLE_LENGTH} />
        </div>
        <Textarea
          value={tc.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="e.g., 1. i stopped doing practice cases alone in my head"
          className="min-h-[56px] resize-none text-sm lowercase"
          maxLength={MAX_TITLE_LENGTH}
        />
      </div>

      {/* Subtitle / context */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Context</Label>
          <CharCount current={tc.subtitle.length} max={MAX_SUBTITLE_LENGTH} />
        </div>
        <Textarea
          value={tc.subtitle}
          onChange={(e) => update("subtitle", e.target.value)}
          placeholder="e.g., i kept freezing up because there was no feedback loop"
          className="min-h-[56px] resize-none text-sm lowercase"
          maxLength={MAX_SUBTITLE_LENGTH}
        />
      </div>

      {/* Action */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Action</Label>
          <CharCount current={tc.action.length} max={MAX_ACTION_LENGTH} />
        </div>
        <Textarea
          value={tc.action}
          onChange={(e) => update("action", e.target.value)}
          placeholder="e.g., i started using the road to offer app to practice with ai feedback daily"
          className="min-h-[56px] resize-none text-sm lowercase"
          maxLength={MAX_ACTION_LENGTH}
        />
      </div>
    </div>
  );
}

function CharCount({ current, max }: { current: number; max: number }) {
  const isNearLimit = current > max * 0.85;
  const isAtLimit = current >= max;

  return (
    <span
      className={
        isAtLimit
          ? "text-xs text-destructive font-medium"
          : isNearLimit
            ? "text-xs text-amber-500"
            : "text-xs text-muted-foreground"
      }
    >
      {current}/{max}
    </span>
  );
}
