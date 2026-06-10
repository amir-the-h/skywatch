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

const MAX_TOASTS = 3;

export interface Toast {
  id: string;
  aircraft: EmergencyAircraft;
  label: string;
  color: string;
  timerId: ReturnType<typeof setTimeout>;
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
    const timerId = setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      5000,
    );
    const toast: Toast = { id, aircraft, label: getLabel(aircraft), color: getColor(aircraft), timerId };
    set((s) => {
      const keep = s.toasts.slice(-(MAX_TOASTS - 1));
      const evicted = s.toasts.slice(0, s.toasts.length - keep.length);
      evicted.forEach((t) => clearTimeout(t.timerId));
      return { toasts: [...keep, toast] };
    });
  },
  removeToast: (id) =>
    set((s) => {
      const toast = s.toasts.find((t) => t.id === id);
      if (toast) clearTimeout(toast.timerId);
      return { toasts: s.toasts.filter((t) => t.id !== id) };
    }),
}));
