// src/store/aircraftStore.ts
import { create } from 'zustand';
import type { Aircraft } from '../types/aircraft';
import { interpolatePosition } from '../lib/interpolate';

const PATH_HISTORY_MAX = 50;

interface AircraftStore {
  aircraft: Map<string, Aircraft>;
  pathHistory: Map<string, { lat: number; lon: number }[]>;
  pinnedHexes: Set<string>;
  hoveredHex: string | null;
  lastUpdated: number | null;

  mergeAircraft: (incoming: Aircraft[]) => void;
  removeStale: (hexes: Set<string>) => void;
  pin: (hex: string) => void;
  unpin: (hex: string) => void;
  setHovered: (hex: string | null) => void;
}

export const useAircraftStore = create<AircraftStore>((set) => ({
  aircraft: new Map(),
  pathHistory: new Map(),
  pinnedHexes: new Set(),
  hoveredHex: null,
  lastUpdated: null,

  mergeAircraft: (incoming) =>
    set((state) => {
      const next = new Map(state.aircraft);
      const nextHistory = new Map(state.pathHistory);
      const now = Date.now();
      for (const ac of incoming) {
        const prev = next.get(ac.hex);
        // Advance the stored render position to where interpolation left off,
        // so the next RAF interval continues from the current visual location
        // instead of snapping back to the initial position.
        const advanced = prev ? interpolatePosition(prev, now) : null;
        next.set(ac.hex, {
          ...ac,
          _renderLat: advanced ? advanced._renderLat : ac.lat,
          _renderLon: advanced ? advanced._renderLon : ac.lon,
          _lastSeen: now,
        });
        const existing = nextHistory.get(ac.hex) ?? [];
        const updated = [...existing, { lat: ac.lat, lon: ac.lon }];
        nextHistory.set(ac.hex, updated.slice(-PATH_HISTORY_MAX));
      }
      return { aircraft: next, pathHistory: nextHistory, lastUpdated: now };
    }),

  removeStale: (activeHexes) =>
    set((state) => {
      const next = new Map(state.aircraft);
      const nextHistory = new Map(state.pathHistory);
      for (const hex of next.keys()) {
        if (!activeHexes.has(hex)) {
          next.delete(hex);
          nextHistory.delete(hex);
        }
      }
      const newPinned = new Set([...state.pinnedHexes].filter((h) => next.has(h)));
      return { aircraft: next, pathHistory: nextHistory, pinnedHexes: newPinned };
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
