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

export function applyZoom(zoomLevel: number, deltaY: number): number {
  const factor = Math.pow(0.999, deltaY);
  return Math.min(20, Math.max(0.25, zoomLevel * factor));
}
