export interface PanOffset {
  dLat: number;
  dLon: number;
}

/**
 * Converts a pixel drag delta into a new PanOffset.
 * Positive dx = dragging right = center moves west (dLon decreases).
 * Positive dy = dragging down  = center moves north (dLat increases).
 */
export function applyPan(
  panOffset: PanOffset,
  dx: number,
  dy: number,
  effectiveLat: number,
  effectiveRadius: number,
  canvasWidth: number,
  canvasHeight: number
): PanOffset {
  const kmPerPx = effectiveRadius / (Math.min(canvasWidth, canvasHeight) / 2);
  return {
    dLat: panOffset.dLat + (dy * kmPerPx) / 111.0,
    dLon: panOffset.dLon - (dx * kmPerPx) / (111.0 * Math.cos((effectiveLat * Math.PI) / 180)),
  };
}

/**
 * Applies a wheel zoom toward the point under the cursor (mx, my relative to canvas center).
 * Adjusts panOffset so the geo point under the cursor stays fixed after zoom.
 */
export function applyZoom(
  zoomLevel: number,
  panOffset: PanOffset,
  mx: number,
  my: number,
  canvasWidth: number,
  canvasHeight: number,
  centerLat: number,
  centerLon: number,
  radiusKm: number,
  deltaY: number
): { zoomLevel: number; panOffset: PanOffset } {
  const effectiveRadius = radiusKm / zoomLevel;
  const effectiveLat = centerLat + panOffset.dLat;
  const effectiveLon = centerLon + panOffset.dLon;
  const scale = Math.min(canvasWidth, canvasHeight) / 2 / effectiveRadius;

  // Geo point currently under cursor
  const pointLat = effectiveLat - my / scale / 111.0;
  const pointLon = effectiveLon + mx / scale / (111.0 * Math.cos((effectiveLat * Math.PI) / 180));

  const factor = Math.pow(0.999, deltaY);
  const newZoom = Math.min(20, Math.max(0.25, zoomLevel * factor));
  const newEffectiveRadius = radiusKm / newZoom;
  const newScale = Math.min(canvasWidth, canvasHeight) / 2 / newEffectiveRadius;

  return {
    zoomLevel: newZoom,
    panOffset: {
      dLat: pointLat - centerLat + my / newScale / 111.0,
      dLon: pointLon - centerLon - mx / newScale / (111.0 * Math.cos((pointLat * Math.PI) / 180)),
    },
  };
}
