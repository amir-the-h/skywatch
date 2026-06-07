// src/components/RadarView/RadarCanvas.ts
import type { Aircraft, LabelCondition } from '../../types/aircraft';
import { aircraftColor, lightenHsl } from '../../lib/colorSystem';
import { getAircraftFamily, SILHOUETTE_PATHS } from '../../lib/silhouettes';
import { latLonToCanvas } from '../../lib/geoUtils';
import { inferFlightPhase, getPhaseColor } from '../../lib/flightPhase';
import { shouldShowLabel } from '../../lib/labelVisibility';

interface AircraftRenderData {
  pos: { x: number; y: number };
  color: string;
}

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
  pathHistory: Map<string, { lat: number; lon: number }[]>;
  panOffset: { x: number; y: number };
  trailLength: number;
  labelConditions: LabelCondition[];
}

export function drawRadar(params: RadarDrawParams) {
  const { ctx, width, height, theme, panOffset } = params;
  ctx.clearRect(0, 0, width, height);

  const bg = theme === 'dark' ? '#0a0b0f' : '#f0f0f0';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(panOffset.x, panOffset.y);
  drawRings(params);
  drawGrid(params);
  drawCardinals(params);
  const renderData = drawAllAircraft(params);
  drawAircraftLabels(params, renderData);
  ctx.restore();
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
    const dyKm = i * stepKm;
    const y = height / 2 - dyKm * scale;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

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
const NOSE_OFFSET = AIRCRAFT_SIZE * 0.425;
const HEADING_LINE_LENGTH = AIRCRAFT_SIZE * 3;

function drawAllAircraft(params: RadarDrawParams): Map<string, AircraftRenderData> {
  const { ctx, width, height, centerLat, centerLon, radiusKm, aircraft, hoveredHex, pinnedHexes, theme, pathHistory, trailLength } = params;

  const renderData = new Map<string, AircraftRenderData>();

  for (const ac of aircraft) {
    const pos = latLonToCanvas(ac._renderLat, ac._renderLon, centerLat, centerLon, radiusKm, width, height);
    if (pos.x < -20 || pos.x > width + 20 || pos.y < -20 || pos.y > height + 20) continue;

    const color = aircraftColor(ac.t, theme);
    renderData.set(ac.hex, { pos, color });
    const family = getAircraftFamily(ac.t);
    const pathStr = SILHOUETTE_PATHS[family];
    const isPinned = pinnedHexes.has(ac.hex);
    const isHovered = hoveredHex === ac.hex && !isPinned;
    const isEmergency = (!!ac.emergency && ac.emergency !== 'none') || ac.squawk === '7700' || ac.squawk === '7600' || ac.squawk === '7500';

    // Trail — slice to configured length
    const fullHistory = pathHistory.get(ac.hex);
    const history = fullHistory && trailLength > 0 ? fullHistory.slice(-trailLength) : [];
    if (history.length >= 2) {
      ctx.save();
      ctx.strokeStyle = lightenHsl(color, 0.2);
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.8;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      let first = true;
      for (const { lat, lon } of history) {
        const trailPos = latLonToCanvas(lat, lon, centerLat, centerLon, radiusKm, width, height);
        if (first) { ctx.moveTo(trailPos.x, trailPos.y); first = false; }
        else ctx.lineTo(trailPos.x, trailPos.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Silhouette
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate((ac.track * Math.PI) / 180);
    ctx.scale(AIRCRAFT_SIZE / 200, AIRCRAFT_SIZE / 200);

    const p = new Path2D(pathStr);
    ctx.shadowColor = color;
    ctx.shadowBlur = isEmergency ? 35 : isPinned ? 20 : isHovered ? 14 : 8;
    ctx.lineWidth = isEmergency ? 6 : isPinned ? 2.5 : isHovered ? 3 : 2;

    if (isPinned) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = color;
      ctx.fill(p);
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = color;
    ctx.stroke(p);
    ctx.restore();

    // Heading line
    if (ac.track != null && !Number.isNaN(ac.track)) {
      const trackRad = (ac.track * Math.PI) / 180;
      const noseX = pos.x + Math.sin(trackRad) * NOSE_OFFSET;
      const noseY = pos.y - Math.cos(trackRad) * NOSE_OFFSET;

      ctx.save();
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.7;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(noseX, noseY);
      ctx.lineTo(
        noseX + Math.sin(trackRad) * HEADING_LINE_LENGTH,
        noseY - Math.cos(trackRad) * HEADING_LINE_LENGTH
      );
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  return renderData;
}

const LABEL_W = 100;
const LABEL_H = 52;
const LABEL_OFFSET = 40;

function drawAircraftLabels(params: RadarDrawParams, renderData: Map<string, AircraftRenderData>) {
  const { ctx, width, height, aircraft, theme, labelConditions, pinnedHexes } = params;
  const textColor = theme === 'dark' ? '#e5e7eb' : '#1f2937';

  for (const ac of aircraft) {
    const rd = renderData.get(ac.hex);
    if (!rd) continue;
    if (!shouldShowLabel(ac, pinnedHexes, labelConditions)) continue;
    const { pos, color } = rd;
    const callsign = ac.flight || ac.hex;
    const phase = inferFlightPhase(ac);
    const phaseColor = getPhaseColor(phase);

    // Determine label quadrant — prefer upper-right, avoid edges
    let dx = LABEL_OFFSET;
    let dy = -LABEL_OFFSET;
    if (pos.x > width - LABEL_W - 20) dx = -(LABEL_W + LABEL_OFFSET);
    if (pos.y < LABEL_H + 20) dy = LABEL_OFFSET;

    const lx = pos.x + dx;
    const ly = pos.y + dy;

    // Connector line: aircraft center → nearest corner of label box
    const connX = dx > 0 ? lx : lx + LABEL_W;
    const connY = dy > 0 ? ly : ly + LABEL_H;

    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(connX, connY);
    ctx.stroke();
    ctx.restore();

    // Label background
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme === 'dark' ? 'rgba(10, 11, 15, 0.82)' : 'rgba(240, 242, 248, 0.92)';
    ctx.beginPath();
    ctx.roundRect(lx, ly, LABEL_W, LABEL_H, 5);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Callsign
    ctx.fillStyle = color;
    ctx.font = 'bold 9.5px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(callsign, lx + 7, ly + 7);

    // Altitude + trend arrow
    const altText = `${ac.alt_baro.toLocaleString()} ft`;
    ctx.fillStyle = textColor;
    ctx.font = '8.5px monospace';
    ctx.fillText(altText, lx + 7, ly + 22);

    const trendArrow = ac.baro_rate > 100 ? '▲' : ac.baro_rate < -100 ? '▼' : '—';
    const trendColor = ac.baro_rate > 100 ? '#4ade80' : ac.baro_rate < -100 ? '#f87171' : '#9ca3af';
    const altWidth = ctx.measureText(altText).width;
    ctx.fillStyle = trendColor;
    ctx.font = 'bold 10px monospace';
    ctx.fillText(trendArrow, lx + 7 + altWidth + 3, ly + 21);

    // Speed
    ctx.fillStyle = '#9ca3af';
    ctx.font = '8px monospace';
    ctx.fillText(`${Math.round(ac.gs)} kts`, lx + 7, ly + 36);

    // Phase badge
    const BADGE_W = 28;
    const BADGE_H = 12;
    const badgeX = lx + LABEL_W - BADGE_W - 5;
    const badgeY = ly + LABEL_H - BADGE_H - 4;

    ctx.fillStyle = phaseColor + '33';
    ctx.strokeStyle = phaseColor + '80';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, BADGE_W, BADGE_H, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = phaseColor;
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(phase, badgeX + BADGE_W / 2, badgeY + BADGE_H / 2);

    ctx.restore();
  }
}
