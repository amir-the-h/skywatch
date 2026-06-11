import type { Airport } from '../../../shared/types';

const R_KM = 6371;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function boundingBox(
  lat: number,
  lon: number,
  radiusKm: number
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const latDelta = radiusKm / 111.0;
  const lonDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta,
  };
}

export function latLonToCanvas(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
  radiusKm: number,
  canvasWidth: number,
  canvasHeight: number,
  headingDeg = 0,
): { x: number; y: number } {
  const scale = Math.min(canvasWidth, canvasHeight) / 2 / radiusKm;
  const dxKm = haversineKm(centerLat, centerLon, centerLat, lon) * (lon >= centerLon ? 1 : -1);
  const dyKm = haversineKm(centerLat, centerLon, lat, centerLon) * (lat >= centerLat ? 1 : -1);
  if (headingDeg === 0) {
    return {
      x: canvasWidth / 2 + dxKm * scale,
      y: canvasHeight / 2 - dyKm * scale,
    };
  }
  // Rotate the geographic offset so `headingDeg` faces up.
  // Canvas vector: ox = east (+x), oy = north (-y in canvas → use -dyKm).
  const angle = (-headingDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rx = dxKm * cos - (-dyKm) * sin;
  const ry = dxKm * sin + (-dyKm) * cos;
  return {
    x: canvasWidth / 2 + rx * scale,
    y: canvasHeight / 2 + ry * scale,
  };
}

export function bearingToLatLon(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceKm: number
): { lat: number; lon: number } {
  const d = distanceKm / R_KM;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
    Math.cos(lat1) * Math.sin(d) * Math.cos(bearing)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: (lat2 * 180) / Math.PI,
    lon: (lon2 * 180) / Math.PI,
  };
}

export function findClosestAirport(
  airports: Airport[],
  mx: number,
  my: number,
  centerLat: number,
  centerLon: number,
  radiusKm: number,
  width: number,
  height: number,
  headingDeg = 0,
): Airport | null {
  let closest: Airport | null = null;
  let minDist = 18;
  for (const airport of airports) {
    const pos = latLonToCanvas(airport.lat, airport.lon, centerLat, centerLon, radiusKm, width, height, headingDeg);
    const dist = Math.hypot(mx - pos.x, my - pos.y);
    if (dist < minDist) {
      minDist = dist;
      closest = airport;
    }
  }
  return closest;
}
