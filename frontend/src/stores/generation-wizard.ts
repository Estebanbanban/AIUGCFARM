import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface GenerationWizardState {
  step: number;
  productId: string | null;
  personaId: string | null;
  mode: "single" | "triple";
  setStep: (step: number) => void;
  setProductId: (id: string) => void;
  setPersonaId: (id: string) => void;
  setMode: (mode: "single" | "triple") => void;
  reset: () => void;
}

export const useGenerationWizardStore = create<GenerationWizardState>()(
  immer((set) => ({
    step: 1,
    productId: null,
    personaId: null,
    mode: "single",
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
    reset: () =>
      set(() => ({
        step: 1,
        productId: null,
        personaId: null,
        mode: "single" as const,
      })),
  }))
);
