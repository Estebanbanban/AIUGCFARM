"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { AdvancedSegmentCard } from "./AdvancedSegmentCard";
import type { AdvancedSegmentConfig, AdvancedSegmentsConfig } from "@/types/database";

const SEG_TYPE_LABELS = {
  hooks: "Hook",
  bodies: "Body",
  ctas: "CTA",
} as const;

interface AdvancedModePanelProps {
  mode: "single" | "triple";
  segments: AdvancedSegmentsConfig;
  productId: string;
  personaId: string;
  format: "9:16" | "16:9";
  mainCompositeSignedUrl: string | null;
  onSegmentUpdate: (
    type: "hooks" | "bodies" | "ctas",
    index: number,
    patch: Partial<AdvancedSegmentConfig>,
  ) => void;
}

export function AdvancedModePanel({
  mode,
  segments,
  productId,
  personaId,
  format,
  mainCompositeSignedUrl,
  onSegmentUpdate,
}: AdvancedModePanelProps) {
  const segTypes = ["hooks", "bodies", "ctas"] as const;

  if (mode === "single") {
    return (
      <div className="flex flex-col gap-4">
        {segTypes.map((segType) => (
          <AdvancedSegmentCard
            key={segType}
            segmentType={segType === "hooks" ? "hook" : segType === "bodies" ? "body" : "cta"}
            variantIndex={0}
            segmentLabel={SEG_TYPE_LABELS[segType]}
            config={segments[segType][0]}
            productId={productId}
            personaId={personaId}
            format={format}
            mainCompositeSignedUrl={mainCompositeSignedUrl}
            onUpdate={(patch) => onSegmentUpdate(segType, 0, patch)}
          />
        ))}
      </div>
    );
  }

  // Triple mode: 3-column grid, one column per variant
  return (
    <ScrollArea className="w-full">
      <div className="grid min-w-[840px] grid-cols-3 gap-4">
        {[0, 1, 2].map((variantIdx) => (
          <div key={variantIdx} className="flex min-w-[280px] flex-col gap-4">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Variant {variantIdx + 1}
            </h3>
            {segTypes.map((segType) => (
              <AdvancedSegmentCard
                key={segType}
                segmentType={segType === "hooks" ? "hook" : segType === "bodies" ? "body" : "cta"}
                variantIndex={variantIdx}
                segmentLabel={SEG_TYPE_LABELS[segType]}
                variantLabel={`V${variantIdx + 1}`}
                config={segments[segType][variantIdx]}
                productId={productId}
                personaId={personaId}
                format={format}
                mainCompositeSignedUrl={mainCompositeSignedUrl}
                onUpdate={(patch) => onSegmentUpdate(segType, variantIdx, patch)}
              />
            ))}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
