import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface WatchedGeneration {
  id: string;
  productName?: string;
  startedAt: string; // ISO date string
  notified: boolean;
}

interface WatchedGenerationsState {
  generations: WatchedGeneration[];
  add: (id: string, productName?: string) => void;
  markNotified: (id: string) => void;
  cleanupOld: () => void;
}

export const useWatchedGenerationsStore = create<WatchedGenerationsState>()(
  persist(
    (set) => ({
      generations: [],
      add: (id, productName) =>
        set((state) => ({
          generations: [
            ...state.generations.filter((g) => g.id !== id),
            { id, productName, startedAt: new Date().toISOString(), notified: false },
          ],
        })),
      markNotified: (id) =>
        set((state) => ({
          generations: state.generations.map((g) =>
            g.id === id ? { ...g, notified: true } : g
          ),
        })),
      cleanupOld: () =>
        set((state) => {
          const cutoff = Date.now() - 24 * 60 * 60 * 1000;
          return {
            generations: state.generations.filter(
              (g) => new Date(g.startedAt).getTime() > cutoff
            ),
          };
        }),
    }),
    {
      name: "cinerads-watched-generations",
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
    }
  )
);
