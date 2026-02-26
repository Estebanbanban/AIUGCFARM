import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface GenerationWizardState {
  step: number;
  productId: string | null;
  personaId: string | null;
  hookCount: number;
  bodyCount: number;
  ctaCount: number;
  setStep: (step: number) => void;
  setProductId: (id: string) => void;
  setPersonaId: (id: string) => void;
  setHookCount: (count: number) => void;
  setBodyCount: (count: number) => void;
  setCtaCount: (count: number) => void;
  totalSegments: () => number;
  reset: () => void;
}

export const useGenerationWizardStore = create<GenerationWizardState>()(
  immer((set, get) => ({
    step: 1,
    productId: null,
    personaId: null,
    hookCount: 3,
    bodyCount: 3,
    ctaCount: 3,
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
    setHookCount: (count) =>
      set((state) => {
        state.hookCount = count;
      }),
    setBodyCount: (count) =>
      set((state) => {
        state.bodyCount = count;
      }),
    setCtaCount: (count) =>
      set((state) => {
        state.ctaCount = count;
      }),
    totalSegments: () => get().hookCount + get().bodyCount + get().ctaCount,
    reset: () =>
      set(() => ({
        step: 1,
        productId: null,
        personaId: null,
        hookCount: 3,
        bodyCount: 3,
        ctaCount: 3,
      })),
  }))
);
