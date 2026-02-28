"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const [activeVariant, setActiveVariant] = useState(0);

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

  // Triple mode: tabbed on mobile, 3-column grid on lg+
  const variantColumn = (variantIdx: number) => (
    <div key={variantIdx} className="flex min-w-[280px] flex-col gap-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        Variant {variantIdx + 1}
        {variantIdx === 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="size-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="top">
                3 hooks &times; 3 bodies &times; 3 CTAs = 27 possible video combinations
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
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
  );

  return (
    <>
      {/* Mobile / tablet: tabbed variant selector */}
      <div className="lg:hidden">
        <div role="tablist" className="flex gap-2 mb-4">
          {[0, 1, 2].map((idx) => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={activeVariant === idx}
              onClick={() => setActiveVariant(idx)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeVariant === idx
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Variant {idx + 1}
            </button>
          ))}
        </div>
        {variantColumn(activeVariant)}
      </div>

      {/* Desktop: 3-column horizontal scroll */}
      <div className="hidden lg:block">
        <ScrollArea className="w-full">
          <div className="grid min-w-[840px] grid-cols-3 gap-4">
            {[0, 1, 2].map((variantIdx) => variantColumn(variantIdx))}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
