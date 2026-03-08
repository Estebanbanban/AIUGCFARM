import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ScriptSegment, AdvancedSegmentConfig, AdvancedSegmentsConfig } from "@/types/database";

interface PendingScript {
  hooks: ScriptSegment[];
  bodies: ScriptSegment[];
  ctas: ScriptSegment[];
}

type CompositePreviewCache = Record<string, string[]>;

export interface PresetConfig {
  product_id: string;
  persona_id: string;
  mode: "single" | "triple";
  quality: "standard" | "hd";
  format: "9:16" | "16:9";
  cta_style: "auto" | "product_name_drop" | "link_in_bio" | "link_in_comments" | "comment_keyword" | "check_description" | "direct_website" | "discount_code";
  cta_comment_keyword?: string;
  language: string;
  video_provider?: "kling" | "sora";
  hooks_count?: number;
  bodies_count?: number;
  ctas_count?: number;
}

interface GenerationWizardState {
  step: number;
  productId: string | null;
  personaId: string | null;
  mode: "single" | "triple";
  quality: "standard" | "hd";
  format: "9:16" | "16:9" | null;
  ctaStyle:
    | "auto"
    | "product_name_drop"
    | "link_in_bio"
    | "link_in_comments"
    | "comment_keyword"
    | "check_description"
    | "direct_website"
    | "discount_code";
  ctaCommentKeyword: string;
  language: string;
  compositeImagePath: string | null;
  selectedProductImages: string[];
  pendingGenerationId: string | null;
  pendingScript: PendingScript | null;
  creditsToCharge: number | null;
  compositePreviewCache: CompositePreviewCache;
  // Advanced Mode
  advancedMode: boolean;
  advancedSegments: AdvancedSegmentsConfig | null;
  hooksCount: number;
  bodiesCount: number;
  ctasCount: number;
  // Video provider (HD only)
  videoProvider: "kling" | "sora";
  // Actions
  setStep: (step: number) => void;
  setProductId: (id: string) => void;
  setPersonaId: (id: string) => void;
  setMode: (mode: "single" | "triple") => void;
  setQuality: (quality: "standard" | "hd") => void;
  setFormat: (format: "9:16" | "16:9" | null) => void;
  setCtaStyle: (
    style:
      | "auto"
      | "product_name_drop"
      | "link_in_bio"
      | "link_in_comments"
      | "comment_keyword"
      | "check_description"
      | "direct_website"
      | "discount_code",
  ) => void;
  setCtaCommentKeyword: (keyword: string) => void;
  setLanguage: (lang: string) => void;
  setCompositeImagePath: (path: string | null) => void;
  setSelectedProductImages: (images: string[]) => void;
  setPendingScript: (id: string, script: PendingScript, credits: number) => void;
  setCompositePreviewCache: (key: string, paths: string[]) => void;
  appendCompositePreviewCache: (key: string, path: string) => void;
  clearCompositePreviewCache: (key?: string) => void;
  updateScriptSection: (type: "hooks" | "bodies" | "ctas", index: number, text: string) => void;
  clearPendingScript: () => void;
  setAdvancedMode: (enabled: boolean) => void;
  setAdvancedSegments: (segments: AdvancedSegmentsConfig | null) => void;
  setHooksCount: (n: number) => void;
  setBodiesCount: (n: number) => void;
  setCtasCount: (n: number) => void;
  setVideoProvider: (provider: "kling" | "sora") => void;
  updateAdvancedSegment: (
    type: "hooks" | "bodies" | "ctas",
    index: number,
    patch: Partial<AdvancedSegmentConfig>,
  ) => void;
  loadPreset: (config: PresetConfig) => void;
  /** Hydrate the wizard from a DB generation record (for dashboard resume). */
  resumeFromGeneration: (params: {
    generationId: string;
    script: PendingScript;
    creditsToCharge: number;
    productId: string;
    personaId: string;
    mode: "single" | "triple";
    quality: "standard" | "hd";
  }) => void;
  reset: () => void;
}

export const useGenerationWizardStore = create<GenerationWizardState>()(
  persist(
    immer((set) => ({
      step: 1,
      productId: null,
      personaId: null,
      mode: "single",
      quality: "standard",
      format: null,
      ctaStyle: "auto",
      ctaCommentKeyword: "",
      language: "en",
      compositeImagePath: null,
      selectedProductImages: [],
      pendingGenerationId: null,
      pendingScript: null,
      creditsToCharge: null,
      compositePreviewCache: {},
      advancedMode: false,
      advancedSegments: null,
      hooksCount: 3,
      bodiesCount: 3,
      ctasCount: 3,
      videoProvider: "kling",
      setStep: (step) =>
        set((state) => {
          state.step = step;
        }),
      setProductId: (id) =>
        set((state) => {
          state.productId = id;
          state.selectedProductImages = [];
        }),
      setPersonaId: (id) =>
        set((state) => {
          state.personaId = id;
        }),
      setMode: (mode) =>
        set((state) => {
          state.mode = mode;
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
      setLanguage: (lang) =>
        set((state) => {
          state.language = lang;
        }),
      setCompositeImagePath: (path) =>
        set((state) => {
          state.compositeImagePath = path;
        }),
      setSelectedProductImages: (images) =>
        set((state) => {
          state.selectedProductImages = images;
        }),
      setPendingScript: (id, script, credits) =>
        set((state) => {
          state.pendingGenerationId = id;
          state.pendingScript = script;
          state.creditsToCharge = credits;
        }),
      setCompositePreviewCache: (key, paths) =>
        set((state) => {
          const unique = [...new Set(paths.filter((p) => typeof p === "string" && p.length > 0))];
          state.compositePreviewCache[key] = unique;
        }),
      appendCompositePreviewCache: (key, path) =>
        set((state) => {
          if (!path) return;
          const existing = state.compositePreviewCache[key] ?? [];
          state.compositePreviewCache[key] = [path, ...existing.filter((p) => p !== path)].slice(0, 12);
        }),
      clearCompositePreviewCache: (key) =>
        set((state) => {
          if (!key) {
            state.compositePreviewCache = {};
            return;
          }
          delete state.compositePreviewCache[key];
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
      setAdvancedMode: (enabled) =>
        set((state) => {
          state.advancedMode = enabled;
          // Don't clear advancedSegments here — preserve them so switching
          // Easy→Advanced→Easy→Advanced doesn't regenerate scripts.
          // advancedSegments is cleared by setMode when the mode (single/triple) changes.
        }),
      setAdvancedSegments: (segments) =>
        set((state) => {
          state.advancedSegments = segments;
        }),
      setHooksCount: (n) => set({ hooksCount: Math.min(5, Math.max(1, n)) }),
      setBodiesCount: (n) => set({ bodiesCount: Math.min(5, Math.max(1, n)) }),
      setCtasCount: (n) => set({ ctasCount: Math.min(5, Math.max(1, n)) }),
      setVideoProvider: (provider) =>
        set((state) => {
          state.videoProvider = provider;
        }),
      updateAdvancedSegment: (type, index, patch) =>
        set((state) => {
          if (!state.advancedSegments) return;
          const seg = state.advancedSegments[type][index];
          if (!seg) return;
          Object.assign(seg, patch);
        }),
      loadPreset: (config) =>
        set({
          productId: config.product_id,
          personaId: config.persona_id,
          mode: config.mode,
          quality: config.quality,
          format: config.format,
          ctaStyle: config.cta_style,
          ctaCommentKeyword: config.cta_comment_keyword ?? "",
          language: config.language,
          videoProvider: config.video_provider ?? "kling",
          hooksCount: config.hooks_count ?? 3,
          bodiesCount: config.bodies_count ?? 3,
          ctasCount: config.ctas_count ?? 3,
          step: 4,
          // Reset session-specific state
          compositeImagePath: null,
          selectedProductImages: [],
          pendingGenerationId: null,
          pendingScript: null,
          creditsToCharge: null,
          advancedMode: false,
          advancedSegments: null,
        }),
      resumeFromGeneration: ({ generationId, script, creditsToCharge, productId, personaId, mode, quality }) =>
        set((state) => {
          state.pendingGenerationId = generationId;
          state.pendingScript = script;
          state.creditsToCharge = creditsToCharge;
          state.productId = productId;
          state.personaId = personaId;
          state.mode = mode;
          state.quality = quality;
          state.step = 5;
        }),
      reset: () =>
        set((state) => ({
          step: 1,
          productId: null,
          personaId: null,
          mode: "single" as const,
          quality: "standard" as const,
          format: null,
          ctaStyle: "auto" as const,
          ctaCommentKeyword: "",
          language: "en" as const,
          compositeImagePath: null,
          selectedProductImages: [],
          pendingGenerationId: null,
          pendingScript: null,
          creditsToCharge: null,
          // Preserve preview cache across sessions/resets.
          compositePreviewCache: state.compositePreviewCache,
          advancedMode: false,
          advancedSegments: null,
          videoProvider: "kling" as const,
        })),
    })),
    {
      name: "cinerads-generation-wizard",
      storage: createJSONStorage(() => {
        // Safe SSR guard - localStorage is not available on the server.
        // Return a no-op StateStorage so Zustand persist doesn't crash during SSR.
        if (typeof window === "undefined") {
          return {
            getItem: (_key: string) => null,
            setItem: (_key: string, _value: string) => {},
            removeItem: (_key: string) => {},
          };
        }
        return localStorage;
      }),
      // Don't persist action functions (Zustand handles this automatically)
      // Explicitly skip advancedSegments - large, session-specific
      partialize: (state) => ({
        step: state.step,
        productId: state.productId,
        personaId: state.personaId,
        mode: state.mode,
        quality: state.quality,
        format: state.format,
        ctaStyle: state.ctaStyle,
        ctaCommentKeyword: state.ctaCommentKeyword,
        language: state.language,
        compositeImagePath: state.compositeImagePath,
        selectedProductImages: state.selectedProductImages,
        pendingGenerationId: state.pendingGenerationId,
        pendingScript: state.pendingScript,
        creditsToCharge: state.creditsToCharge,
        compositePreviewCache: state.compositePreviewCache,
        advancedMode: state.advancedMode,
        videoProvider: state.videoProvider,
        hooksCount: state.hooksCount,
        bodiesCount: state.bodiesCount,
        ctasCount: state.ctasCount,
        // advancedSegments intentionally excluded - complex, per-session
      }),
      version: 1,
    },
  ),
);
