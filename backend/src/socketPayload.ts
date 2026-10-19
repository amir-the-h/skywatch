export interface LocationPayload {
  lat: number;
  lon: number;
  radiusKm: number;
}

// Socket payloads are untrusted: reject anything that isn't a finite, in-range
// coordinate, and cap the radius so one client can't trigger huge upstream queries.
export function parseLocation(payload: unknown, maxRadiusKm: number): LocationPayload | null {
  if (!payload || typeof payload !== 'object') return null;
  const { lat, lon, radiusKm } = payload as Record<string, unknown>;
  if (typeof lat !== 'number' || typeof lon !== 'number' || typeof radiusKm !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radiusKm)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180 || radiusKm <= 0) return null;
  return { lat, lon, radiusKm: Math.min(radiusKm, maxRadiusKm) };
}
