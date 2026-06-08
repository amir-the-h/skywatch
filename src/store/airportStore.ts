import { create } from 'zustand';
import type { Airport } from '../../shared/types';

interface AirportState {
  airports: Airport[];
  setAirports: (airports: Airport[]) => void;
}

export const useAirportStore = create<AirportState>((set) => ({
  airports: [],
  setAirports: (airports) => set({ airports }),
}));
