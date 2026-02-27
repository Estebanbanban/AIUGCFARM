import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface GenerationWizardState {
  step: number;
  productId: string | null;
  personaId: string | null;
  mode: "single" | "triple";
  quality: "standard" | "hd";
  format: "9:16" | "16:9";
  compositeImagePath: string | null;
  setStep: (step: number) => void;
  setProductId: (id: string) => void;
  setPersonaId: (id: string) => void;
  setMode: (mode: "single" | "triple") => void;
  setQuality: (quality: "standard" | "hd") => void;
  setFormat: (format: "9:16" | "16:9") => void;
  setCompositeImagePath: (path: string | null) => void;
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
    compositeImagePath: null,
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
    setCompositeImagePath: (path) =>
      set((state) => {
        state.compositeImagePath = path;
      }),
    reset: () =>
      set(() => ({
        step: 1,
        productId: null,
        personaId: null,
        mode: "single" as const,
        quality: "standard" as const,
        format: "9:16" as const,
        compositeImagePath: null,
      })),
  }))
);
