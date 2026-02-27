import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { ScriptSegment } from "@/types/database";

interface PendingScript {
  hooks: ScriptSegment[];
  bodies: ScriptSegment[];
  ctas: ScriptSegment[];
}

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
  pendingGenerationId: string | null;
  pendingScript: PendingScript | null;
  creditsToCharge: number | null;
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
  setPendingScript: (id: string, script: PendingScript, credits: number) => void;
  updateScriptSection: (type: "hooks" | "bodies" | "ctas", index: number, text: string) => void;
  clearPendingScript: () => void;
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
    pendingGenerationId: null,
    pendingScript: null,
    creditsToCharge: null,
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
    setPendingScript: (id, script, credits) =>
      set((state) => {
        state.pendingGenerationId = id;
        state.pendingScript = script;
        state.creditsToCharge = credits;
      }),
    updateScriptSection: (type, index, text) =>
      set((state) => {
        if (state.pendingScript && state.pendingScript[type][index]) {
          state.pendingScript[type][index].text = text;
        }
      }),
    clearPendingScript: () =>
      set((state) => {
        state.pendingGenerationId = null;
        state.pendingScript = null;
        state.creditsToCharge = null;
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
        pendingGenerationId: null,
        pendingScript: null,
        creditsToCharge: null,
      })),
  }))
);
