import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist, createJSONStorage } from "zustand/middleware";

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
  generatedImages: string[];       // signed URLs — NOT persisted (1hr expiry)
  selectedImageIndex: number | null;
  isGenerating: boolean;           // transient — NOT persisted
  isSaving: boolean;               // transient — NOT persisted
  personaId: string | null;        // persisted — used to restore images from DB
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
  persist(
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
    })),
    {
      name: "cinerads-persona-builder",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") return sessionStorage;
        return localStorage;
      }),
      // Exclude transient runtime state and signed URLs that expire after 1 hour.
      // personaId IS persisted — the page uses it to re-fetch signed image URLs from DB.
      partialize: (state) => ({
        name: state.name,
        gender: state.gender,
        ageRange: state.ageRange,
        ethnicity: state.ethnicity,
        skinTone: state.skinTone,
        hairColor: state.hairColor,
        hairStyle: state.hairStyle,
        eyeColor: state.eyeColor,
        bodyType: state.bodyType,
        clothingStyle: state.clothingStyle,
        accessories: state.accessories,
        personaId: state.personaId,
        selectedImageIndex: state.selectedImageIndex,
        // generatedImages: excluded — signed URLs expire after 1 hour
        // isGenerating, isSaving: excluded — transient flags
      }),
      version: 1,
    },
  ),
);
