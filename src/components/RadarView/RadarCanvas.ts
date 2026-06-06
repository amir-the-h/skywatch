// src/components/RadarView/RadarCanvas.ts
import type { Aircraft } from '../../types/aircraft';
import { aircraftColor } from '../../lib/colorSystem';
import { getAircraftFamily, SILHOUETTE_PATHS } from '../../lib/silhouettes';
import { latLonToCanvas } from '../../lib/geoUtils';

export interface RadarDrawParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  centerLat: number;
  centerLon: number;
  radiusKm: number;
  ringIntervals: number[];
  aircraft: Aircraft[];
  hoveredHex: string | null;
  pinnedHexes: Set<string>;
  theme: 'dark' | 'light';
}

export function drawRadar(params: RadarDrawParams) {
  const { ctx, width, height, theme } = params;
  ctx.clearRect(0, 0, width, height);

  const bg = theme === 'dark' ? '#0a0b0f' : '#f0f0f0';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  drawRings(params);
  drawGrid(params);
  drawCardinals(params);
  drawAllAircraft(params);
}

function drawRings({ ctx, width, height, radiusKm, ringIntervals, theme }: RadarDrawParams) {
  const cx = width / 2;
  const cy = height / 2;
  const scale = Math.min(width, height) / 2 / radiusKm;
  const ringColor = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
  const labelColor = theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)';

  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 1;
  ctx.font = '11px monospace';
  ctx.fillStyle = labelColor;
  ctx.textAlign = 'center';

  for (const km of ringIntervals) {
    if (km > radiusKm) continue;
    const r = km * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillText(`${km}km`, cx, cy - r + 14);
  }
}

function drawGrid({ ctx, width, height, radiusKm, theme }: RadarDrawParams) {
  const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;

  const scale = Math.min(width, height) / 2 / radiusKm;
  const stepKm = radiusKm / 4;

  for (let i = -4; i <= 4; i++) {
    // Horizontal lines (latitude)
    const dyKm = i * stepKm;
    const y = height / 2 - dyKm * scale;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    // Vertical lines (longitude) — equal km spacing, same as horizontal
    const dxKm = i * stepKm;
    const x = width / 2 + dxKm * scale;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
}

function drawCardinals({ ctx, width, height, radiusKm, theme }: RadarDrawParams) {
  const cx = width / 2;
  const cy = height / 2;
  const scale = Math.min(width, height) / 2 / radiusKm;
  const outerR = radiusKm * scale;
  const color = theme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)';

  ctx.fillStyle = color;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillText('N', cx, cy - outerR - 12);
  ctx.fillText('S', cx, cy + outerR + 12);
  ctx.fillText('W', cx - outerR - 14, cy);
  ctx.fillText('E', cx + outerR + 14, cy);
}

const AIRCRAFT_SIZE = 28;

function drawAllAircraft(params: RadarDrawParams) {
  const { ctx, width, height, centerLat, centerLon, radiusKm, aircraft, hoveredHex, pinnedHexes, theme } = params;

  for (const ac of aircraft) {
    const pos = latLonToCanvas(ac._renderLat, ac._renderLon, centerLat, centerLon, radiusKm, width, height);
    if (pos.x < -20 || pos.x > width + 20 || pos.y < -20 || pos.y > height + 20) continue;

    const color = aircraftColor(ac.t, theme);
    const family = getAircraftFamily(ac.t);
    const pathStr = SILHOUETTE_PATHS[family];
    const isHighlighted = hoveredHex === ac.hex || pinnedHexes.has(ac.hex);
    const isEmergency = (!!ac.emergency && ac.emergency !== 'none') || ac.squawk === '7700' || ac.squawk === '7600' || ac.squawk === '7500';

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate((ac.track * Math.PI) / 180);
    // viewBox is 100x200; scale to AIRCRAFT_SIZE
    ctx.scale(AIRCRAFT_SIZE / 200, AIRCRAFT_SIZE / 200);

    const p = new Path2D(pathStr);

    ctx.shadowColor = color;
    ctx.shadowBlur = isEmergency ? 35 : isHighlighted ? 20 : 8;
    ctx.strokeStyle = color;
    ctx.lineWidth = isEmergency ? 6 : isHighlighted ? 5 : 3;
    ctx.stroke(p);

    ctx.restore();
  }
}
