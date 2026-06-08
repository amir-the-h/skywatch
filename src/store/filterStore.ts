import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FlightPhase } from '../lib/flightPhase';
import type { FilterCriteria } from '../lib/aircraftFilter';

export const DEFAULT_ALT_MIN = 0;
export const DEFAULT_ALT_MAX = 60000;

const DEFAULT_FILTER: FilterCriteria = {
  callsigns: [],
  altMin: DEFAULT_ALT_MIN,
  altMax: DEFAULT_ALT_MAX,
  phases: [],
  manufacturers: [],
  models: [],
};

export interface FilterStore extends FilterCriteria {
  setCallsigns: (v: string[]) => void;
  setAltRange: (min: number, max: number) => void;
  setPhases: (phases: FlightPhase[]) => void;
  setManufacturers: (v: string[]) => void;
  setModels: (v: string[]) => void;
  reset: () => void;
}

export const useFilterStore = create<FilterStore>()(
  persist(
    (set) => ({
      ...DEFAULT_FILTER,
      setCallsigns: (callsigns) => set({ callsigns }),
      setAltRange: (altMin, altMax) => set({ altMin, altMax }),
      setPhases: (phases) => set({ phases }),
      setManufacturers: (manufacturers) => set({ manufacturers }),
      setModels: (models) => set({ models }),
      reset: () => set(DEFAULT_FILTER),
    }),
    { name: 'ft-filters' }
  )
);

export function isFilterActive(f: FilterCriteria): boolean {
  return (
    f.callsigns.length > 0 ||
    f.manufacturers.length > 0 ||
    f.models.length > 0 ||
    f.altMin > DEFAULT_ALT_MIN ||
    f.altMax < DEFAULT_ALT_MAX ||
    f.phases.length > 0
  );
}
