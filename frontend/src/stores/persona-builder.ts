import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface PersonaBuilderState {
  name: string;
  gender: string;
  ageRange: string;
  skinTone: string;
  hairColor: string;
  hairStyle: string;
  eyeColor: string;
  bodyType: string;
  clothingStyle: string;
  accessories: string[];
  generatedImages: string[];
  selectedImageIndex: number | null;
  isGenerating: boolean;
  setField: (field: string, value: string) => void;
  toggleAccessory: (accessory: string) => void;
  setGeneratedImages: (urls: string[]) => void;
  selectImage: (index: number) => void;
  setIsGenerating: (val: boolean) => void;
  reset: () => void;
}

const initialState = {
  name: "",
  gender: "female",
  ageRange: "25_35",
  skinTone: "#F1C27D",
  hairColor: "Dark Brown",
  hairStyle: "Medium Straight",
  eyeColor: "Brown",
  bodyType: "average",
  clothingStyle: "Casual",
  accessories: [] as string[],
  generatedImages: [] as string[],
  selectedImageIndex: null as number | null,
  isGenerating: false,
};

export const usePersonaBuilderStore = create<PersonaBuilderState>()(
  immer((set) => ({
    ...initialState,
    setField: (field, value) =>
      set((state) => {
        (state as Record<string, unknown>)[field] = value;
      }),
    toggleAccessory: (accessory) =>
      set((state) => {
        const idx = state.accessories.indexOf(accessory);
        if (idx >= 0) state.accessories.splice(idx, 1);
        else if (state.accessories.length < 5) state.accessories.push(accessory);
      }),
    setGeneratedImages: (urls) =>
      set((state) => {
        state.generatedImages = urls;
        state.selectedImageIndex = null;
      }),
    selectImage: (index) =>
      set((state) => {
        state.selectedImageIndex = index;
      }),
    setIsGenerating: (val) =>
      set((state) => {
        state.isGenerating = val;
      }),
    reset: () => set(() => ({ ...initialState })),
  }))
);
