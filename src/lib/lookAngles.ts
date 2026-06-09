const R_FT = 6371000 * 3.28084; // Earth radius in feet

const DEG = Math.PI / 180;

export function haversineDistanceFt(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const φ1 = lat1 * DEG;
  const φ2 = lat2 * DEG;
  const Δφ = (lat2 - lat1) * DEG;
  const Δλ = (lng2 - lng1) * DEG;

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R_FT * 2 * Math.asin(Math.sqrt(a));
}

export function bearingDeg(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const φ1 = lat1 * DEG;
  const φ2 = lat2 * DEG;
  const Δλ = (lng2 - lng1) * DEG;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return ((Math.atan2(y, x) / DEG) + 360) % 360;
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
  return Math.atan2(aircraftAltFt - observerElevFt, distanceFt) / DEG;
}
