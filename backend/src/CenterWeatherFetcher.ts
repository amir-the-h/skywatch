import type { PointWeather } from '../../shared/types';

const BASE = 'https://api.open-meteo.com/v1/forecast';

export async function fetchCenterWeather(lat: number, lon: number): Promise<PointWeather | null> {
  const url =
    `${BASE}?latitude=${lat}&longitude=${lon}` +
    `&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
    `&wind_speed_unit=kn`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`[center_weather] HTTP ${res.status} for ${lat},${lon}`);
      return null;
    }
    const body = await res.json() as {
      current?: {
        wind_speed_10m?: number;
        wind_direction_10m?: number;
        wind_gusts_10m?: number;
        time?: string;
      };
    };
    const c = body.current;
    if (!c) return null;
    return {
      windDir: typeof c.wind_direction_10m === 'number' ? Math.round(c.wind_direction_10m) : null,
      windSpeed: Math.round(c.wind_speed_10m ?? 0),
      windGust: typeof c.wind_gusts_10m === 'number' && c.wind_gusts_10m > 0 ? Math.round(c.wind_gusts_10m) : null,
      observedAt: c.time ?? new Date().toISOString(),
    };
  } catch (err) {
    console.log(`[center_weather] Fetch error: ${err}`);
    return null;
  }
}
