import type { Airport } from '../types/airport';

let cache: Airport[] | null = null;
let pending: Promise<Airport[]> | null = null;

export async function fetchAirports(): Promise<Airport[]> {
  if (cache) return cache;
  if (!pending) {
    pending = fetch('/airports.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch airports: ${res.status}`);
        return res.json() as Promise<Airport[]>;
      })
      .then((data) => {
        cache = data;
        pending = null;
        return data;
      })
      .catch((e) => {
        pending = null;
        throw e;
      });
  }
  return pending;
}
