import { create } from 'zustand';
import type { FlightPhase } from '../lib/flightPhase';
import type { FilterCriteria } from '../lib/aircraftFilter';

export const DEFAULT_ALT_MIN = 0;
export const DEFAULT_ALT_MAX = 60000;

const DEFAULT_FILTER: FilterCriteria = {
  callsign: '',
  altMin: DEFAULT_ALT_MIN,
  altMax: DEFAULT_ALT_MAX,
  phases: [],
  manufacturer: '',
  model: '',
};

export interface FilterStore extends FilterCriteria {
  setCallsign: (v: string) => void;
  setAltRange: (min: number, max: number) => void;
  setPhases: (phases: FlightPhase[]) => void;
  setManufacturer: (v: string) => void;
  setModel: (v: string) => void;
  reset: () => void;
}

export const useFilterStore = create<FilterStore>((set) => ({
  ...DEFAULT_FILTER,
  setCallsign: (callsign) => set({ callsign }),
  setAltRange: (altMin, altMax) => set({ altMin, altMax }),
  setPhases: (phases) => set({ phases }),
  setManufacturer: (manufacturer) => set({ manufacturer }),
  setModel: (model) => set({ model }),
  reset: () => set(DEFAULT_FILTER),
}));

export function isFilterActive(f: FilterCriteria): boolean {
  return (
    f.callsign !== '' ||
    f.manufacturer !== '' ||
    f.model !== '' ||
    f.altMin > DEFAULT_ALT_MIN ||
    f.altMax < DEFAULT_ALT_MAX ||
    f.phases.length > 0
  );
}
