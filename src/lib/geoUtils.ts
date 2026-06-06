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
  canvasHeight: number
): { x: number; y: number } {
  const scale = Math.min(canvasWidth, canvasHeight) / 2 / radiusKm;
  const dxKm = haversineKm(centerLat, centerLon, centerLat, lon) * (lon >= centerLon ? 1 : -1);
  const dyKm = haversineKm(centerLat, centerLon, lat, centerLon) * (lat >= centerLat ? 1 : -1);
  return {
    x: canvasWidth / 2 + dxKm * scale,
    y: canvasHeight / 2 - dyKm * scale,
  };
}
