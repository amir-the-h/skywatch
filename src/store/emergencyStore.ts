import { create } from 'zustand';
import type { EmergencyAircraft } from '../../shared/types';

interface EmergencyStore {
  aircraft: EmergencyAircraft[];
  seenHexes: Set<string>;
  pendingNotifications: EmergencyAircraft[];
  setEmergency: (incoming: EmergencyAircraft[]) => void;
  clearNotifications: () => void;
}

export const useEmergencyStore = create<EmergencyStore>((set, get) => ({
  aircraft: [],
  seenHexes: new Set(),
  pendingNotifications: [],
  setEmergency: (incoming) => {
    const { seenHexes } = get();
    const newOnes = incoming.filter((ac) => !seenHexes.has(ac.hex));
    set({
      aircraft: incoming,
      seenHexes: new Set(incoming.map((ac) => ac.hex)),
      pendingNotifications: newOnes,
    });
  },
  clearNotifications: () => set({ pendingNotifications: [] }),
}));
