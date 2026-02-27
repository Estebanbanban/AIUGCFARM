import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface GenerationWizardState {
  step: number;
  productId: string | null;
  personaId: string | null;
  mode: "single" | "triple";
  quality: "standard" | "hd";
  setStep: (step: number) => void;
  setProductId: (id: string) => void;
  setPersonaId: (id: string) => void;
  setMode: (mode: "single" | "triple") => void;
  setQuality: (quality: "standard" | "hd") => void;
  reset: () => void;
}

export const useGenerationWizardStore = create<GenerationWizardState>()(
  immer((set) => ({
    step: 1,
    productId: null,
    personaId: null,
    mode: "single",
    quality: "standard",
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
    reset: () =>
      set(() => ({
        step: 1,
        productId: null,
        personaId: null,
        mode: "single" as const,
        quality: "standard" as const,
      })),
  }))
);
