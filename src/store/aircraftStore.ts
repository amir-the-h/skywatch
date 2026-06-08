// src/store/aircraftStore.ts
import { create } from 'zustand';
import type { Aircraft } from '../types/aircraft';
import type { BackendAircraft } from '../../shared/types';

interface AircraftStore {
  aircraft: Map<string, Aircraft>;
  pinnedHexes: Set<string>;
  hoveredHex: string | null;
  lastUpdated: number | null;

  mergeAircraft: (incoming: BackendAircraft[], fetchedAt?: number) => void;
  removeStale: (hexes: Set<string>) => void;
  pin: (hex: string) => void;
  unpin: (hex: string) => void;
  setHovered: (hex: string | null) => void;
}

export const useAircraftStore = create<AircraftStore>((set) => ({
  aircraft: new Map(),
  pinnedHexes: new Set(),
  hoveredHex: null,
  lastUpdated: null,

  mergeAircraft: (incoming, fetchedAt = Date.now()) =>
    set((state) => {
      const next = new Map(state.aircraft);
      const now = Date.now();
      for (const ac of incoming) {
        next.set(ac.hex, {
          ...ac,
          _renderLat: ac.lat,
          _renderLon: ac.lon,
          _lastSeen: fetchedAt - ac.seen * 1000,
        });
      }
      return { aircraft: next, lastUpdated: now };
    }),

  removeStale: (activeHexes) =>
    set((state) => {
      const next = new Map(state.aircraft);
      for (const hex of next.keys()) {
        if (!activeHexes.has(hex)) {
          next.delete(hex);
        }
      }
      const newPinned = new Set([...state.pinnedHexes].filter((h) => next.has(h)));
      return { aircraft: next, pinnedHexes: newPinned };
    }),

  pin: (hex) =>
    set((s) => ({ pinnedHexes: new Set([...s.pinnedHexes, hex]) })),

  unpin: (hex) =>
    set((s) => {
      const next = new Set(s.pinnedHexes);
      next.delete(hex);
      return { pinnedHexes: next };
    }),

  setHovered: (hex) => set({ hoveredHex: hex }),
}));
