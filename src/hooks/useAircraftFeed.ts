import { useEffect, useRef } from 'react';
import { fetchAircraft } from '../api/airplanesLive';
import { useAircraftStore } from '../store/aircraftStore';
import { useSettingsStore } from './useSettings';

export function useAircraftFeed() {
  const { lat, lng, radiusKm, refreshInterval } = useSettingsStore();
  const { mergeAircraft, removeStale } = useAircraftStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const aircraft = await fetchAircraft(lat, lng, radiusKm);
        if (cancelled) return;
        mergeAircraft(aircraft);
        const activeHexes = new Set(aircraft.map((a) => a.hex));
        removeStale(activeHexes);
      } catch {
        // silently ignore — stale data stays visible
      }
    };

    poll();
    timerRef.current = setInterval(poll, refreshInterval * 1000);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lat, lng, radiusKm, refreshInterval, mergeAircraft, removeStale]);
}
