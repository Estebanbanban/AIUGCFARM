import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist, createJSONStorage } from "zustand/middleware";

export type SoraModel = "sora-2" | "sora-2-pro";
export type ReferenceType = "composite" | "persona" | "custom" | "none";
export type ScriptFormat = "structured" | "freeform";

export interface StructuredScript {
  hook: string;
  body: string;
  cta: string;
}

interface VideoCreatorState {
  // Script
  scriptFormat: ScriptFormat;
  freeformPrompt: string;
  structuredScript: StructuredScript | null;
  // Context (all optional)
  productId: string | null;
  personaId: string | null;
  isSaas: boolean;
  // Video settings
  soraModel: SoraModel;
  duration: 4 | 8 | 12;
  // Reference image
  referenceType: ReferenceType;
  customReferenceImagePath: string | null;
  customReferencePreviewUrl: string | null;
  // Misc
  language: string;
  // Generation state
  generationId: string | null;
  creditsToCharge: number | null;

  // Actions
  setScriptFormat: (format: ScriptFormat) => void;
  setFreeformPrompt: (prompt: string) => void;
  setStructuredScript: (script: StructuredScript | null) => void;
  updateStructuredField: (field: keyof StructuredScript, value: string) => void;
  setProductId: (id: string | null) => void;
  setPersonaId: (id: string | null) => void;
  setIsSaas: (enabled: boolean) => void;
  setSoraModel: (model: SoraModel) => void;
  setDuration: (duration: 4 | 8 | 12) => void;
  setReferenceType: (type: ReferenceType) => void;
  setCustomReferenceImagePath: (path: string | null) => void;
  setCustomReferencePreviewUrl: (url: string | null) => void;
  setLanguage: (lang: string) => void;
  setGenerationId: (id: string | null) => void;
  setCreditsToCharge: (credits: number | null) => void;
  reset: () => void;
}

const initialState = {
  scriptFormat: "freeform" as ScriptFormat,
  freeformPrompt: "",
  structuredScript: null,
  productId: null,
  personaId: null,
  isSaas: false,
  soraModel: "sora-2" as SoraModel,
  duration: 12 as 4 | 8 | 12,
  referenceType: "none" as ReferenceType,
  customReferenceImagePath: null,
  customReferencePreviewUrl: null,
  language: "en",
  generationId: null,
  creditsToCharge: null,
};

export const useVideoCreatorStore = create<VideoCreatorState>()(
  persist(
    immer((set) => ({
      ...initialState,

      setScriptFormat: (format) =>
        set((state) => {
          state.scriptFormat = format;
        }),
      setFreeformPrompt: (prompt) =>
        set((state) => {
          state.freeformPrompt = prompt;
        }),
      setStructuredScript: (script) =>
        set((state) => {
          state.structuredScript = script;
        }),
      updateStructuredField: (field, value) =>
        set((state) => {
          if (!state.structuredScript) {
            state.structuredScript = { hook: "", body: "", cta: "" };
          }
          state.structuredScript[field] = value;
        }),
      setProductId: (id) =>
        set((state) => {
          state.productId = id;
        }),
      setPersonaId: (id) =>
        set((state) => {
          state.personaId = id;
        }),
      setIsSaas: (enabled) =>
        set((state) => {
          state.isSaas = enabled;
        }),
      setSoraModel: (model) =>
        set((state) => {
          state.soraModel = model;
        }),
      setDuration: (duration) =>
        set((state) => {
          state.duration = duration;
        }),
      setReferenceType: (type) =>
        set((state) => {
          state.referenceType = type;
          // Clear custom image when switching away
          if (type !== "custom") {
            state.customReferenceImagePath = null;
            state.customReferencePreviewUrl = null;
          }
        }),
      setCustomReferenceImagePath: (path) =>
        set((state) => {
          state.customReferenceImagePath = path;
        }),
      setCustomReferencePreviewUrl: (url) =>
        set((state) => {
          state.customReferencePreviewUrl = url;
        }),
      setLanguage: (lang) =>
        set((state) => {
          state.language = lang;
        }),
      setGenerationId: (id) =>
        set((state) => {
          state.generationId = id;
        }),
      setCreditsToCharge: (credits) =>
        set((state) => {
          state.creditsToCharge = credits;
        }),
      reset: () =>
        set(() => ({ ...initialState })),
    })),
    {
      name: "cinerads-video-creator",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: (_key: string) => null,
            setItem: (_key: string, _value: string) => {},
            removeItem: (_key: string) => {},
          };
        }
        return localStorage;
      }),
      partialize: (state) => ({
        scriptFormat: state.scriptFormat,
        freeformPrompt: state.freeformPrompt,
        structuredScript: state.structuredScript,
        productId: state.productId,
        personaId: state.personaId,
        isSaas: state.isSaas,
        soraModel: state.soraModel,
        duration: state.duration,
        referenceType: state.referenceType,
        customReferenceImagePath: state.customReferenceImagePath,
        language: state.language,
        generationId: state.generationId,
        creditsToCharge: state.creditsToCharge,
      }),
      version: 1,
    },
  ),
);
