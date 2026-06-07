import type { Airport } from '../types/airport';

let cache: Airport[] | null = null;

export async function fetchAirports(): Promise<Airport[]> {
  if (cache) return cache;
  const res = await fetch('/airports.json');
  if (!res.ok) throw new Error(`Failed to fetch airports: ${res.status}`);
  cache = (await res.json()) as Airport[];
  return cache;
}
