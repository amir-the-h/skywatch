import { haversineKm } from './geoUtils';

const DEG_TO_RAD = Math.PI / 180;

export function haversineDistanceFt(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  return haversineKm(lat1, lng1, lat2, lng2) * 1000 * 3.28084;
}

export function bearingDeg(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const φ1 = lat1 * DEG_TO_RAD;
  const φ2 = lat2 * DEG_TO_RAD;
  const Δλ = (lng2 - lng1) * DEG_TO_RAD;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return ((Math.atan2(y, x) / DEG_TO_RAD) + 360) % 360;
}

const CARDINALS = [
  'N', 'NNE', 'NE', 'ENE',
  'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW',
  'W', 'WNW', 'NW', 'NNW',
];

export function cardinalDir(bearing: number): string {
  return CARDINALS[Math.round(bearing / 22.5) % 16];
}

export function elevationAngleDeg(
  observerElevFt: number,
  aircraftAltFt: number,
  distanceFt: number,
): number {
  return Math.atan2(aircraftAltFt - observerElevFt, distanceFt) / DEG_TO_RAD;
}
