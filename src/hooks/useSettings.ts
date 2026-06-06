import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '../types/aircraft';
import { DEFAULT_SETTINGS } from '../types/aircraft';

interface SettingsStore extends Settings {
  update: (patch: Partial<Settings>) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set((s) => ({ ...s, ...patch })),
    }),
    { name: 'ft-settings' }
  )
);
