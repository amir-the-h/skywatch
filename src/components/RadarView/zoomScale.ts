export function iconScaleForZoom(zoomLevel: number): number {
  return Math.sqrt(zoomLevel);
}

export function screenPosToCull(
  posX: number,
  posY: number,
  panOffsetX: number,
  panOffsetY: number,
  width: number,
  height: number,
  padding: number,
): boolean {
  const sx = posX + panOffsetX;
  const sy = posY + panOffsetY;
  return sx < -padding || sx > width + padding || sy < -padding || sy > height + padding;
}
