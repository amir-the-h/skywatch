import { useMemo } from 'react';
import { useSettingsStore } from './useSettings';
import { useAirportStore } from '../store/airportStore';
import type { Airport } from '../../../shared/types';

export function useAirports(): Airport[] {
  const { showAirports, airportTypes } = useSettingsStore();
  const airports = useAirportStore((s) => s.airports);

  return useMemo(
    () =>
      showAirports
        ? airports.filter((a) => (airportTypes as string[]).includes(a.type))
        : [],
    [airports, showAirports, airportTypes]
  );
}
