import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Slide, SlideshowSettings, SlideTextContent } from "@/types/slideshow";
import { DEFAULT_SLIDESHOW_SETTINGS } from "@/types/slideshow";

interface SlideshowEditorState {
  // Current slideshow
  slideshowId: string | null;
  name: string;
  settings: SlideshowSettings;
  slides: Slide[];
  selectedSlideIndex: number;
  hookText: string | null;
  productId: string | null;
  status: "draft" | "rendering" | "complete" | "failed";

  // UI state
  isPlaying: boolean;
  isDirty: boolean;
  selectedCollectionId: string | null;

  // Actions
  loadSlideshow: (id: string, name: string, settings: SlideshowSettings, slides: Slide[], hookText: string | null, productId: string | null, status: string) => void;
  setName: (name: string) => void;
  setSettings: (settings: Partial<SlideshowSettings>) => void;
  setOverlayOpacity: (opacity: number) => void;
  setTextSettings: (text: Partial<SlideshowSettings["text"]>) => void;

  // Slide management
  addSlide: (type?: "hook" | "body" | "cta") => void;
  removeSlide: (index: number) => void;
  reorderSlides: (fromIndex: number, toIndex: number) => void;
  selectSlide: (index: number) => void;
  updateSlideText: (index: number, text: string) => void;
  updateSlideTextContent: (index: number, content: Partial<SlideTextContent>) => void;
  updateSlideImage: (index: number, imageId: string, imageUrl: string) => void;
  updateSlideOverlay: (index: number, opacity: number) => void;

  // Hook management
  setHookText: (text: string) => void;
  applyHookToFirstSlide: (text: string) => void;
  applyGeneratedCopy: (slides: Array<{ title: string; subtitle: string; action: string; order: number }>) => void;

  // Playback
  setPlaying: (playing: boolean) => void;
  nextSlide: () => void;

  // Collection
  setSelectedCollectionId: (id: string | null) => void;

  // Product
  setProductId: (id: string | null) => void;

  // Status
  setStatus: (status: "draft" | "rendering" | "complete" | "failed") => void;

  // Reset
  reset: () => void;
}

const initialState = {
  slideshowId: null,
  name: "",
  settings: DEFAULT_SLIDESHOW_SETTINGS,
  slides: [],
  selectedSlideIndex: 0,
  hookText: null,
  productId: null,
  status: "draft" as const,
  isPlaying: false,
  isDirty: false,
  selectedCollectionId: null,
};

export const useSlideshowEditorStore = create<SlideshowEditorState>()(
  persist(
    immer((set) => ({
      ...initialState,

      loadSlideshow: (id, name, settings, slides, hookText, productId, status) =>
        set((state) => {
          state.slideshowId = id;
          state.name = name;
          state.settings = settings;
          state.slides = slides;
          state.hookText = hookText;
          state.productId = productId;
          state.status = status as "draft" | "rendering" | "complete" | "failed";
          state.selectedSlideIndex = 0;
          state.isDirty = false;
          state.isPlaying = false;
          state.selectedCollectionId = null; // Reset so auto-select runs for new slideshow
        }),

      setName: (name) =>
        set((state) => {
          state.name = name;
          state.isDirty = true;
        }),

      setSettings: (settings) =>
        set((state) => {
          Object.assign(state.settings, settings);
          state.isDirty = true;
        }),

      setOverlayOpacity: (opacity) =>
        set((state) => {
          state.settings.overlay.opacity = opacity;
          state.isDirty = true;
        }),

      setTextSettings: (text) =>
        set((state) => {
          Object.assign(state.settings.text, text);
          state.isDirty = true;
        }),

      addSlide: (type = "body") =>
        set((state) => {
          const newSlide: Slide = {
            id: crypto.randomUUID(),
            type,
            order: state.slides.length,
            imageId: null,
            imageUrl: null,
            text: "",
            textContent: type === "body" || type === "cta" ? { title: "", subtitle: "", action: "" } : undefined,
          };

          // Insert before the last CTA slide (if exists)
          const lastCtaIndex = state.slides.findLastIndex((s) => s.type === "cta");
          if (lastCtaIndex >= 0 && type !== "cta") {
            state.slides.splice(lastCtaIndex, 0, newSlide);
          } else {
            state.slides.push(newSlide);
          }

          // Reorder all slides
          state.slides.forEach((s, i) => { s.order = i; });

          // Select the new slide
          const newIndex = state.slides.findIndex((s) => s.id === newSlide.id);
          state.selectedSlideIndex = newIndex >= 0 ? newIndex : state.slides.length - 1;
          state.isDirty = true;
        }),

      removeSlide: (index) =>
        set((state) => {
          if (index < 0 || index >= state.slides.length) return;
          state.slides.splice(index, 1);
          // Update order fields
          state.slides.forEach((slide, i) => {
            slide.order = i;
          });
          // Adjust selected index
          if (state.selectedSlideIndex >= state.slides.length) {
            state.selectedSlideIndex = Math.max(0, state.slides.length - 1);
          }
          state.isDirty = true;
        }),

      reorderSlides: (fromIndex, toIndex) =>
        set((state) => {
          if (
            fromIndex < 0 || fromIndex >= state.slides.length ||
            toIndex < 0 || toIndex >= state.slides.length
          ) return;
          const [moved] = state.slides.splice(fromIndex, 1);
          state.slides.splice(toIndex, 0, moved);
          // Update order fields
          state.slides.forEach((slide, i) => {
            slide.order = i;
          });
          state.selectedSlideIndex = toIndex;
          state.isDirty = true;
        }),

      selectSlide: (index) =>
        set((state) => {
          if (index >= 0 && index < state.slides.length) {
            state.selectedSlideIndex = index;
          }
        }),

      updateSlideText: (index, text) =>
        set((state) => {
          if (state.slides[index]) {
            state.slides[index].text = text;
            state.isDirty = true;
          }
        }),

      updateSlideTextContent: (index, content) =>
        set((state) => {
          if (state.slides[index]) {
            if (!state.slides[index].textContent) {
              state.slides[index].textContent = { title: "", subtitle: "", action: "" };
            }
            Object.assign(state.slides[index].textContent!, content);
            state.isDirty = true;
          }
        }),

      updateSlideImage: (index, imageId, imageUrl) =>
        set((state) => {
          if (state.slides[index]) {
            state.slides[index].imageId = imageId;
            state.slides[index].imageUrl = imageUrl;
            state.isDirty = true;
          }
        }),

      updateSlideOverlay: (index, opacity) =>
        set((state) => {
          if (state.slides[index]) {
            state.slides[index].overlayOpacity = opacity;
            state.isDirty = true;
          }
        }),

      setHookText: (text) =>
        set((state) => {
          state.hookText = text;
          state.isDirty = true;
        }),

      applyHookToFirstSlide: (text) =>
        set((state) => {
          const hookSlide = state.slides.find((s) => s.type === "hook");
          if (hookSlide) {
            hookSlide.text = text;
          } else if (state.slides.length > 0) {
            state.slides[0].text = text;
          }
          state.hookText = text;
          state.isDirty = true;
        }),

      applyGeneratedCopy: (generatedSlides) =>
        set((state) => {
          // Get existing body/cta slides
          const bodyCtaSlides = state.slides.filter((s) => s.type === "body" || s.type === "cta");

          // Apply to existing slides
          generatedSlides.forEach((gen, i) => {
            if (i < bodyCtaSlides.length) {
              const target = bodyCtaSlides[i];
              target.textContent = { title: gen.title, subtitle: gen.subtitle, action: gen.action };
              target.text = gen.title;
            }
          });

          // If more generated than existing, add new body slides
          if (generatedSlides.length > bodyCtaSlides.length) {
            const newSlides: Slide[] = [];
            for (let i = bodyCtaSlides.length; i < generatedSlides.length; i++) {
              const gen = generatedSlides[i];
              newSlides.push({
                id: crypto.randomUUID(),
                type: "body",
                order: 0,
                imageId: null,
                imageUrl: null,
                text: gen.title,
                textContent: { title: gen.title, subtitle: gen.subtitle, action: gen.action },
              });
            }
            // Find CTA position and insert all new slides before it in one go
            const lastCtaIdx = state.slides.findLastIndex((s) => s.type === "cta");
            if (lastCtaIdx >= 0) {
              state.slides.splice(lastCtaIdx, 0, ...newSlides);
            } else {
              state.slides.push(...newSlides);
            }
            // Reorder
            state.slides.forEach((s, idx) => { s.order = idx; });
          }

          state.isDirty = true;
        }),

      setPlaying: (playing) =>
        set((state) => {
          state.isPlaying = playing;
        }),

      nextSlide: () =>
        set((state) => {
          if (state.slides.length > 0) {
            state.selectedSlideIndex = (state.selectedSlideIndex + 1) % state.slides.length;
          }
        }),

      setSelectedCollectionId: (id) =>
        set((state) => {
          state.selectedCollectionId = id;
        }),

      setProductId: (id) =>
        set((state) => {
          state.productId = id;
          state.isDirty = true;
        }),

      setStatus: (status) =>
        set((state) => {
          state.status = status;
          // Don't mark dirty — status reflects server state, not user edits
        }),

      reset: () =>
        set(() => ({ ...initialState })),
    })),
    {
      name: "slideshow-editor",
      storage: createJSONStorage(() => {
        // Safe SSR guard - localStorage is not available on the server.
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
        slideshowId: state.slideshowId,
        name: state.name,
        settings: state.settings,
        slides: state.slides,
        selectedSlideIndex: state.selectedSlideIndex,
        hookText: state.hookText,
        productId: state.productId,
        status: state.status,
        // isDirty intentionally NOT persisted — always false on reload
      }),
      version: 1,
    },
  ),
);
