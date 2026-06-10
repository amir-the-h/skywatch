import { create } from 'zustand';
import type { EmergencyAircraft } from '../../shared/types';

const SQUAWK_COLORS: Record<string, string> = {
  '7700': '#ef4444',
  '7500': '#f97316',
  '7600': '#eab308',
};

const EMERGENCY_LABELS: Record<string, string> = {
  '7700': 'MAYDAY',
  '7500': 'HIJACK',
  '7600': 'NORDO',
  general: 'MAYDAY',
  unlawful: 'HIJACK',
  nordo: 'NORDO',
  lifeguard: 'LIFEGUARD',
  minfuel: 'MIN FUEL',
  downed: 'DOWNED',
};

function getLabel(ac: EmergencyAircraft): string {
  return EMERGENCY_LABELS[ac.squawk ?? ''] ?? EMERGENCY_LABELS[ac.emergency ?? ''] ?? 'EMERGENCY';
}

function getColor(ac: EmergencyAircraft): string {
  return SQUAWK_COLORS[ac.squawk ?? ''] ?? '#ef4444';
}

export interface Toast {
  id: string;
  aircraft: EmergencyAircraft;
  label: string;
  color: string;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (aircraft: EmergencyAircraft) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (aircraft) => {
    const id = `${aircraft.hex}-${Date.now()}`;
    const toast: Toast = { id, aircraft, label: getLabel(aircraft), color: getColor(aircraft) };
    set((s) => ({ toasts: [...s.toasts.slice(-2), toast] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 5000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
