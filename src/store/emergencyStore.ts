import { create } from 'zustand';
import type { EmergencyAircraft } from '../../shared/types';

interface EmergencyStore {
  aircraft: EmergencyAircraft[];
  setEmergency: (aircraft: EmergencyAircraft[]) => void;
}

export const useEmergencyStore = create<EmergencyStore>((set) => ({
  aircraft: [],
  setEmergency: (aircraft) => set({ aircraft }),
}));
