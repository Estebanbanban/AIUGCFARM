import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface PersonaBuilderState {
  name: string;
  gender: string;
  ageRange: string;
  ethnicity: string;
  skinTone: string; // kept for backward-compat when loading old personas
  hairColor: string;
  hairStyle: string;
  eyeColor: string;
  bodyType: string;
  clothingStyle: string;
  accessories: string[];
  generatedImages: string[];
  selectedImageIndex: number | null;
  isGenerating: boolean;
  isSaving: boolean;
  personaId: string | null;
  setField: (field: string, value: string) => void;
  toggleAccessory: (accessory: string) => void;
  setGeneratedImages: (urls: string[]) => void;
  selectImage: (index: number) => void;
  setIsGenerating: (val: boolean) => void;
  setIsSaving: (val: boolean) => void;
  setPersonaId: (id: string) => void;
  initFromPersona: (persona: {
    id: string;
    name: string;
    attributes: {
      gender?: string;
      age?: string;
      ethnicity?: string;
      skin_tone?: string;
      hair_color?: string;
      hair_style?: string;
      eye_color?: string;
      body_type?: string;
      clothing_style?: string;
      accessories?: string[];
    };
  }) => void;
  reset: () => void;
}

const initialState = {
  name: "",
  gender: "female",
  ageRange: "25_35",
  ethnicity: "White / Caucasian",
  skinTone: "#F1C27D", // legacy, kept for old persona compatibility
  hairColor: "Dark Brown",
  hairStyle: "Medium Straight",
  eyeColor: "Brown",
  bodyType: "average",
  clothingStyle: "Casual",
  accessories: [] as string[],
  generatedImages: [] as string[],
  selectedImageIndex: null as number | null,
  isGenerating: false,
  isSaving: false,
  personaId: null as string | null,
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
    setIsSaving: (val) =>
      set((state) => {
        state.isSaving = val;
      }),
    setPersonaId: (id) =>
      set((state) => {
        state.personaId = id;
      }),
    initFromPersona: (persona) =>
      set(() => ({
        ...initialState,
        personaId: persona.id,
        name: persona.name,
        gender: persona.attributes.gender ?? initialState.gender,
        ageRange: persona.attributes.age ?? initialState.ageRange,
        ethnicity: persona.attributes.ethnicity ?? initialState.ethnicity,
        skinTone: persona.attributes.skin_tone ?? initialState.skinTone,
        hairColor: persona.attributes.hair_color ?? initialState.hairColor,
        hairStyle: persona.attributes.hair_style ?? initialState.hairStyle,
        eyeColor: persona.attributes.eye_color ?? initialState.eyeColor,
        bodyType: persona.attributes.body_type ?? initialState.bodyType,
        clothingStyle: persona.attributes.clothing_style ?? initialState.clothingStyle,
        accessories: persona.attributes.accessories ?? [],
      })),
    reset: () => set(() => ({ ...initialState })),
  }))
);
