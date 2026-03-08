"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  // Triple mode: tab interface (one tab per variant)
  return (
    <Tabs defaultValue="variant-0">
      <TabsList className="w-full">
        {[0, 1, 2].map((idx) => (
          <TabsTrigger key={idx} value={`variant-${idx}`} className="flex-1">
            {`Variant ${idx + 1}`}
          </TabsTrigger>
        ))}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="flex items-center px-2 text-muted-foreground" tabIndex={-1}>
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Up to 5 hooks &times; 5 bodies &times; 5 CTAs = up to 125 possible combinations
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TabsList>
      {[0, 1, 2].map((variantIdx) => (
        <TabsContent key={variantIdx} value={`variant-${variantIdx}`}>
          <div className="space-y-4">
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
        </TabsContent>
      ))}
    </Tabs>
  );
}
