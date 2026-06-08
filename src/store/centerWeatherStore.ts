import { create } from 'zustand';
import type { PointWeather } from '../../../shared/types';

interface CenterWeatherState {
  centerWeather: PointWeather | null;
  setCenterWeather: (w: PointWeather | null) => void;
}

export const useCenterWeatherStore = create<CenterWeatherState>((set) => ({
  centerWeather: null,
  setCenterWeather: (centerWeather) => set({ centerWeather }),
}));
