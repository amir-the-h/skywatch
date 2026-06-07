// src/hooks/useAirports.ts
import { useEffect, useMemo, useState } from 'react';
import { useSettingsStore } from './useSettings';
import { fetchAirports } from '../api/airports';
import { haversineKm } from '../lib/geoUtils';
import type { Airport } from '../types/airport';

interface UseAirportsResult {
  airports: Airport[];
  loading: boolean;
  error: string | null;
}

export function useAirports(): UseAirportsResult {
  const { lat, lng, radiusKm, showAirports, airportTypes } = useSettingsStore();
  const [all, setAll] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!showAirports || all.length > 0) return;
    let cancelled = false;
    setLoading(true);
    fetchAirports()
      .then((data) => { if (!cancelled) setAll(data); })
      .catch((e) => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [showAirports]);

  const airports = useMemo(
    () =>
      showAirports
        ? all.filter(
            (a) =>
              (airportTypes as string[]).includes(a.type) &&
              haversineKm(lat, lng, a.lat, a.lon) <= radiusKm
          )
        : [],
    [all, showAirports, airportTypes, lat, lng, radiusKm]
  );

  return { airports, loading, error };
}
