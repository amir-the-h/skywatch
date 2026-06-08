import { create } from 'zustand';
import type { MetarData } from '../../shared/types';

interface MetarState {
  metar: Map<string, MetarData>;
  mergeMetar: (updates: Record<string, MetarData>) => void;
}

export const useMetarStore = create<MetarState>((set) => ({
  metar: new Map(),
  mergeMetar: (updates) =>
    set((state) => {
      const next = new Map(state.metar);
      for (const [icao, data] of Object.entries(updates)) next.set(icao, data);
      return { metar: next };
    }),
}));
