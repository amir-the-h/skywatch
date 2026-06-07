const CELL_DEG = 0.045; // ≈ 5 km per design spec

export function snapToGrid(lat: number, lon: number): { gLat: number; gLon: number } {
  return {
    gLat: Math.round(lat / CELL_DEG) * CELL_DEG,
    gLon: Math.round(lon / CELL_DEG) * CELL_DEG,
  };
}

export function cellKey(gLat: number, gLon: number): string {
  return `${gLat.toFixed(4)}:${gLon.toFixed(4)}`;
}
