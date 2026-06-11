import { create } from 'zustand';
import { useSettingsStore } from './useSettings';

interface CompassState {
  isActive: boolean;
  error: 'denied' | 'unsupported' | null;
  enable: () => Promise<void>;
  disable: () => void;
}

// Module-level refs so disable() can remove the exact same function reference.
let _listener: ((e: DeviceOrientationEvent) => void) | null = null;
let _eventName: string | null = null;

export const useCompassStore = create<CompassState>()((set, get) => ({
  isActive: false,
  error: null,

  enable: async () => {
    if (get().isActive) return;
    if (typeof (window as unknown as Record<string, unknown>).DeviceOrientationEvent === 'undefined') {
      set({ error: 'unsupported' });
      return;
    }
    const DOE = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<PermissionState>;
    };
    if (typeof DOE.requestPermission === 'function') {
      let permission: PermissionState;
      try {
        permission = await DOE.requestPermission();
      } catch {
        set({ error: 'denied' });
        return;
      }
      if (permission !== 'granted') {
        set({ error: 'denied' });
        return;
      }
    }
    _listener = (e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      const heading = e.alpha ?? e.webkitCompassHeading;
      if (heading == null) return;
      useSettingsStore.getState().update({ headingDeg: Math.round(heading) % 360 });
    };
    _eventName = 'ondeviceorientationabsolute' in window
      ? 'deviceorientationabsolute'
      : 'deviceorientation';
    window.addEventListener(_eventName, _listener as EventListener);
    set({ isActive: true, error: null });
  },

  disable: () => {
    if (_listener && _eventName) {
      window.removeEventListener(_eventName, _listener as EventListener);
      _listener = null;
      _eventName = null;
    }
    set({ isActive: false, error: null });
  },
}));
