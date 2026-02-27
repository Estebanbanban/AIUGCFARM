import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { AdvancedSegmentConfig, AdvancedSegmentsConfig } from "@/types/database";

interface GenerationWizardState {
  step: number;
  productId: string | null;
  personaId: string | null;
  mode: "single" | "triple";
  quality: "standard" | "hd";
  format: "9:16" | "16:9";
  ctaStyle:
    | "auto"
    | "product_name_drop"
    | "link_in_bio"
    | "link_in_comments"
    | "comment_keyword"
    | "check_description";
  ctaCommentKeyword: string;
  compositeImagePath: string | null;
  // Advanced Mode
  advancedMode: boolean;
  advancedSegments: AdvancedSegmentsConfig | null;
  // Actions
  setStep: (step: number) => void;
  setProductId: (id: string) => void;
  setPersonaId: (id: string) => void;
  setMode: (mode: "single" | "triple") => void;
  setQuality: (quality: "standard" | "hd") => void;
  setFormat: (format: "9:16" | "16:9") => void;
  setCtaStyle: (
    style:
      | "auto"
      | "product_name_drop"
      | "link_in_bio"
      | "link_in_comments"
      | "comment_keyword"
      | "check_description",
  ) => void;
  setCtaCommentKeyword: (keyword: string) => void;
  setCompositeImagePath: (path: string | null) => void;
  setAdvancedMode: (enabled: boolean) => void;
  setAdvancedSegments: (segments: AdvancedSegmentsConfig | null) => void;
  updateAdvancedSegment: (
    type: "hooks" | "bodies" | "ctas",
    index: number,
    patch: Partial<AdvancedSegmentConfig>,
  ) => void;
  reset: () => void;
}

export const useGenerationWizardStore = create<GenerationWizardState>()(
  immer((set) => ({
    step: 1,
    productId: null,
    personaId: null,
    mode: "single",
    quality: "standard",
    format: "9:16",
    ctaStyle: "auto",
    ctaCommentKeyword: "",
    compositeImagePath: null,
    advancedMode: false,
    advancedSegments: null,
    setStep: (step) =>
      set((state) => {
        state.step = step;
      }),
    setProductId: (id) =>
      set((state) => {
        state.productId = id;
      }),
    setPersonaId: (id) =>
      set((state) => {
        state.personaId = id;
      }),
    setMode: (mode) =>
      set((state) => {
        state.mode = mode;
        // Reset advanced mode when mode changes
        if (state.advancedMode) {
          state.advancedMode = false;
          state.advancedSegments = null;
        }
      }),
    setQuality: (quality) =>
      set((state) => {
        state.quality = quality;
      }),
    setFormat: (format) =>
      set((state) => {
        state.format = format;
      }),
    setCtaStyle: (style) =>
      set((state) => {
        state.ctaStyle = style;
      }),
    setCtaCommentKeyword: (keyword) =>
      set((state) => {
        state.ctaCommentKeyword = keyword;
      }),
    setCompositeImagePath: (path) =>
      set((state) => {
        state.compositeImagePath = path;
      }),
    setAdvancedMode: (enabled) =>
      set((state) => {
        state.advancedMode = enabled;
        if (!enabled) {
          state.advancedSegments = null;
        }
      }),
    setAdvancedSegments: (segments) =>
      set((state) => {
        state.advancedSegments = segments;
      }),
    updateAdvancedSegment: (type, index, patch) =>
      set((state) => {
        if (!state.advancedSegments) return;
        const seg = state.advancedSegments[type][index];
        if (!seg) return;
        Object.assign(seg, patch);
      }),
    reset: () =>
      set(() => ({
        step: 1,
        productId: null,
        personaId: null,
        mode: "single" as const,
        quality: "standard" as const,
        format: "9:16" as const,
        ctaStyle: "auto" as const,
        ctaCommentKeyword: "",
        compositeImagePath: null,
        advancedMode: false,
        advancedSegments: null,
      })),
  }))
);
