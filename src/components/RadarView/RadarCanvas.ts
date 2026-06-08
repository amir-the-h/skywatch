// src/components/RadarView/RadarCanvas.ts
import type { Aircraft, LabelCondition } from '../../types/aircraft';
import type { Airport } from '../../types/airport';
import { aircraftColor, lightenHsl } from '../../lib/colorSystem';
import { getAircraftFamily, SILHOUETTE_PATHS } from '../../lib/silhouettes';
import { latLonToCanvas } from '../../lib/geoUtils';
import { getPhaseColor } from '../../lib/flightPhase';
import { shouldShowLabel } from '../../lib/labelVisibility';
import { iconScaleForZoom, screenPosToCull } from './zoomScale';

export interface AircraftRenderData {
  pos: { x: number; y: number };
  color: string;
}

export interface LabelPlacement {
  lx: number;
  ly: number;
  opacity: number;
  connX: number;
  connY: number;
}

export interface LabelComputeParams {
  width: number;
  height: number;
  aircraft: Aircraft[];
  pinnedHexes: Set<string>;
  labelConditions: LabelCondition[];
  panOffset: { x: number; y: number };
  zoomLevel: number;
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
  panOffset: { x: number; y: number };
  trailLength: number;
  labelConditions: LabelCondition[];
  airports: Airport[];
  zoomLevel: number;
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
  drawAirports(params);
  const renderData = drawAllAircraft(params);
  drawAircraftLabels(params, renderData);
  ctx.restore();
  drawCardinals(params);
}

function drawRings({ ctx, width, height, radiusKm, ringIntervals, theme, zoomLevel }: RadarDrawParams) {
  const cx = width / 2;
  const cy = height / 2;
  const scale = Math.min(width, height) / 2 / radiusKm;
  const originalRadiusKm = radiusKm * zoomLevel;
  const ringColor = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
  const labelColor = theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)';

  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 1;
  ctx.font = '11px monospace';
  ctx.fillStyle = labelColor;
  ctx.textAlign = 'center';

  for (const km of ringIntervals) {
    if (km > originalRadiusKm) continue;
    const r = km * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    if (cy - r + 14 > 0) ctx.fillText(`${km}km`, cx, cy - r + 14);
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

function drawCardinals({ ctx, width, theme }: RadarDrawParams) {
  const color = theme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)';
  ctx.fillStyle = color;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('N', width / 2, 8);
}

function drawAirports(params: RadarDrawParams) {
  const { ctx, width, height, centerLat, centerLon, radiusKm, airports, theme } = params;
  if (!airports.length) return;

  const base = theme === 'dark' ? '255,255,255' : '0,0,0';
  const scale = Math.min(width, height) / 2 / radiusKm;

  for (const airport of airports) {
    const center = latLonToCanvas(airport.lat, airport.lon, centerLat, centerLon, radiusKm, width, height);

    if (airport.runways.length === 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(center.x, center.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${base}, 0.7)`;
      ctx.fill();
      ctx.fillStyle = `rgba(${base}, 0.65)`;
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(airport.iata || airport.icao, center.x + 5, center.y - 10);
      ctx.restore();
      continue;
    }

    let maxLenPx = 0;

    for (const runway of airport.runways) {
      const le = latLonToCanvas(runway.le.lat, runway.le.lon, centerLat, centerLon, radiusKm, width, height);
      const he = latLonToCanvas(runway.he.lat, runway.he.lon, centerLat, centerLon, radiusKm, width, height);

      const dx = he.x - le.x;
      const dy = he.y - le.y;
      const lenPx = Math.hypot(dx, dy);
      if (lenPx < 8) continue;
      maxLenPx = Math.max(maxLenPx, lenPx);

      const cx = (le.x + he.x) / 2;
      const cy = (le.y + he.y) / 2;
      const angle = Math.atan2(dy, dx);
      const widthPx = Math.max(1, runway.widthFt * 0.0003048 * scale);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillStyle = `rgba(${base}, 0.12)`;
      ctx.strokeStyle = `rgba(${base}, 0.45)`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.rect(-lenPx / 2, -widthPx / 2, lenPx, widthPx);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (maxLenPx >= 12) {
      ctx.fillStyle = `rgba(${base}, 0.65)`;
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(airport.iata || airport.icao, center.x + 5, center.y - 10);
    }
  }
}

const AIRCRAFT_SIZE = 28;

function drawAllAircraft(params: RadarDrawParams): Map<string, AircraftRenderData> {
  const { ctx, width, height, centerLat, centerLon, radiusKm, aircraft, hoveredHex, pinnedHexes, theme, trailLength, panOffset, zoomLevel } = params;

  const renderData = new Map<string, AircraftRenderData>();
  const iconScale = iconScaleForZoom(zoomLevel);
  const scaledSize = AIRCRAFT_SIZE * iconScale;
  const noseOffset = scaledSize * 0.425;
  const headingLineLength = scaledSize * 3;
  const cullPadding = scaledSize * 1.5;

  for (const ac of aircraft) {
    const pos = latLonToCanvas(ac._renderLat, ac._renderLon, centerLat, centerLon, radiusKm, width, height);
    if (screenPosToCull(pos.x, pos.y, panOffset.x, panOffset.y, width, height, cullPadding)) continue;

    const color = aircraftColor(ac.t, theme);
    renderData.set(ac.hex, { pos, color });
    const family = getAircraftFamily(ac.t);
    const pathStr = SILHOUETTE_PATHS[family];
    const isPinned = pinnedHexes.has(ac.hex);
    const isHovered = hoveredHex === ac.hex && !isPinned;
    const isEmergency = (!!ac.emergency && ac.emergency !== 'none') || ac.squawk === '7700' || ac.squawk === '7600' || ac.squawk === '7500';

    // Trail
    const fullHistory = ac.pathHistory;
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
    ctx.scale(scaledSize / 200, scaledSize / 200);

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
      const noseX = pos.x + Math.sin(trackRad) * noseOffset;
      const noseY = pos.y - Math.cos(trackRad) * noseOffset;

      ctx.save();
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.7;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(noseX, noseY);
      ctx.lineTo(
        noseX + Math.sin(trackRad) * headingLineLength,
        noseY - Math.cos(trackRad) * headingLineLength
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
const LABEL_OFFSET_NEAR = 44;
const LABEL_OFFSET_FAR = 80;
const LABEL_LERP = 0.12;
const LABEL_MIN_OPACITY = 0.45;
const LABEL_ANGLE_PENALTY = 200;
const LABEL_RESET_THRESHOLD = 40;

const SLOT_ANGLES = [
  -Math.PI / 4,        // 315° upper-right (preferred)
  -Math.PI / 2,        // 270° up
  0,                   // 0°   right
  (-3 * Math.PI) / 4,  // 225° — upper-left in canvas coords (Y-down)
  Math.PI / 4,         // 45°  lower-right
  Math.PI / 2,         // 90°  down
  Math.PI,             // 180° left
  (3 * Math.PI) / 4,   // 135° lower-left
];

const labelPosMap = new Map<string, { x: number; y: number }>();
let prevPan = { x: 0, y: 0 };
let prevZoom = 1;

export function resetLabelState(): void {
  labelPosMap.clear();
  prevPan = { x: 0, y: 0 };
  prevZoom = 1;
}

function rectIntersectionArea(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): number {
  const ix = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
  const iy = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
  return ix * iy;
}

export function computeLabelPositions(
  params: LabelComputeParams,
  renderData: Map<string, AircraftRenderData>,
  s: number,
): Map<string, LabelPlacement> {
  const { aircraft, width, height, pinnedHexes, labelConditions, panOffset, zoomLevel } = params;
  const labelW = LABEL_W * s;
  const labelH = LABEL_H * s;

  // Detect sharp pan/zoom jump — skip lerp this frame to avoid labels sliding across screen
  const panDelta = Math.hypot(panOffset.x - prevPan.x, panOffset.y - prevPan.y);
  const zoomDelta = Math.abs(zoomLevel - prevZoom) * 100;
  const skipLerp = panDelta > LABEL_RESET_THRESHOLD || zoomDelta > LABEL_RESET_THRESHOLD;
  prevPan = { ...panOffset };
  prevZoom = zoomLevel;

  // Filter to aircraft that are rendered and should show a label
  const visible = aircraft.filter(
    ac => renderData.has(ac.hex) && shouldShowLabel(ac, pinnedHexes, labelConditions),
  );

  // Sort by priority so higher-priority aircraft claim best slots first
  const priorityOf = (ac: Aircraft): number => {
    if (pinnedHexes.has(ac.hex)) return 0;
    if (
      (!!ac.emergency && ac.emergency !== 'none') ||
      ac.squawk === '7700' || ac.squawk === '7600' || ac.squawk === '7500'
    ) return 1;
    if (['TXI', 'GND', 'T/O', 'APP'].includes(ac.phase)) return 2;
    return 3;
  };
  visible.sort((a, b) => {
    const diff = priorityOf(a) - priorityOf(b);
    if (diff !== 0) return diff;
    const ca = a.flight ?? a.hex;
    const cb = b.flight ?? b.hex;
    return ca < cb ? -1 : ca > cb ? 1 : 0;
  });

  // Phase 1: Greedy slot selection
  type Committed = { lx: number; ly: number; hex: string };
  const committed: Committed[] = [];

  for (const ac of visible) {
    const { pos } = renderData.get(ac.hex)!;

    if (visible.length === 1) {
      // Fast path: single aircraft — skip scoring, go straight to preferred slot
      const angle = -Math.PI / 4;
      const lx = Math.max(0, Math.min(pos.x + Math.cos(angle) * LABEL_OFFSET_NEAR * s - labelW / 2, width - labelW));
      const ly = Math.max(0, Math.min(pos.y + Math.sin(angle) * LABEL_OFFSET_NEAR * s - labelH / 2, height - labelH));
      committed.push({ lx, ly, hex: ac.hex });
      continue;
    }

    let bestScore = Infinity;
    let bestLx = 0;
    let bestLy = 0;

    for (const angle of SLOT_ANGLES) {
      for (const radius of [LABEL_OFFSET_NEAR * s, LABEL_OFFSET_FAR * s]) {
        const lx = pos.x + Math.cos(angle) * radius - labelW / 2;
        const ly = pos.y + Math.sin(angle) * radius - labelH / 2;

        // Penalty: overlap with already-committed labels
        let overlapScore = 0;
        for (const c of committed) {
          overlapScore += rectIntersectionArea(lx, ly, labelW, labelH, c.lx, c.ly, labelW, labelH);
        }

        // Penalty: pixels outside canvas bounds (weight heavily to keep labels on screen)
        const edgeClip =
          Math.max(0, -lx) +
          Math.max(0, lx + labelW - width) +
          Math.max(0, -ly) +
          Math.max(0, ly + labelH - height);

        // Penalty: angular distance from preferred angle (315° / upper-right)
        const preferredAngle = -Math.PI / 4;
        let angleDiff = Math.abs(angle - preferredAngle);
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
        const anglePenalty = angleDiff * LABEL_ANGLE_PENALTY;

        const score = overlapScore + edgeClip * 10 + anglePenalty;
        if (score < bestScore) {
          bestScore = score;
          bestLx = lx;
          bestLy = ly;
        }
      }
    }

      const clampedLx = Math.max(0, Math.min(bestLx, width - labelW));
    const clampedLy = Math.max(0, Math.min(bestLy, height - labelH));
    committed.push({ lx: clampedLx, ly: clampedLy, hex: ac.hex });
  }

  // Snapshot greedy positions before nudge — used for opacity (reflects slot contention)
  const preNudge = committed.map(c => ({ hex: c.hex, lx: c.lx, ly: c.ly }));
  const preNudgeByHex = new Map<string, { lx: number; ly: number }>();
  for (const p of preNudge) preNudgeByHex.set(p.hex, p);

  // Phase 2: Force nudge — one O(n²) pass to push overlapping pairs apart
  for (let i = 0; i < committed.length; i++) {
    for (let j = i + 1; j < committed.length; j++) {
      const a = committed[i];
      const b = committed[j];
      const ix = Math.max(0, Math.min(a.lx + labelW, b.lx + labelW) - Math.max(a.lx, b.lx));
      const iy = Math.max(0, Math.min(a.ly + labelH, b.ly + labelH) - Math.max(a.ly, b.ly));
      if (ix <= 0 || iy <= 0) continue;
      // Push along the axis with the smaller overlap
      if (ix < iy) {
        const push = ix / 2;
        if (a.lx < b.lx) { a.lx -= push; b.lx += push; }
        else { a.lx += push; b.lx -= push; }
      } else {
        const push = iy / 2;
        if (a.ly < b.ly) { a.ly -= push; b.ly += push; }
        else { a.ly += push; b.ly -= push; }
      }
      // Clamp both to canvas bounds
      a.lx = Math.max(0, Math.min(a.lx, width - labelW));
      a.ly = Math.max(0, Math.min(a.ly, height - labelH));
      b.lx = Math.max(0, Math.min(b.lx, width - labelW));
      b.ly = Math.max(0, Math.min(b.ly, height - labelH));
    }
  }

  // Remove stale lerp entries for aircraft no longer visible
  const liveHexes = new Set(visible.map(ac => ac.hex));
  for (const key of labelPosMap.keys()) {
    if (!liveHexes.has(key)) labelPosMap.delete(key);
  }

  // Apply lerp and compute final placements with opacity
  const result = new Map<string, LabelPlacement>();

  for (const c of committed) {
    const { pos } = renderData.get(c.hex)!;

    // Initialise new entries at target; lerp existing ones toward target
    if (!labelPosMap.has(c.hex) || skipLerp) {
      labelPosMap.set(c.hex, { x: c.lx, y: c.ly });
    } else {
      const cur = labelPosMap.get(c.hex)!;
      cur.x += (c.lx - cur.x) * LABEL_LERP;
      cur.y += (c.ly - cur.y) * LABEL_LERP;
    }

    const cur = labelPosMap.get(c.hex)!;
    const lx = cur.x;
    const ly = cur.y;

    // Opacity: fade proportionally to slot contention — measured from pre-nudge greedy positions
    // for both the subject and its neighbours, so the lerped (animated) position doesn't pollute
    // the overlap check with stale coordinates.
    const preC = preNudgeByHex.get(c.hex)!;
    const labelArea = labelW * labelH;
    let totalOverlap = 0;
    for (const [ohex, oPos] of preNudgeByHex) {
      if (ohex === c.hex) continue;
      totalOverlap += rectIntersectionArea(preC.lx, preC.ly, labelW, labelH, oPos.lx, oPos.ly, labelW, labelH);
    }
    const overlapRatio = totalOverlap / labelArea;
    const opacity = 1 - (1 - LABEL_MIN_OPACITY) * Math.min(1, overlapRatio * 3);

    // Connector: nearest point on the label's bounding edge to the aircraft center
    const connX = Math.max(lx, Math.min(lx + labelW, pos.x));
    const connY = Math.max(ly, Math.min(ly + labelH, pos.y));

    result.set(c.hex, { lx, ly, opacity, connX, connY });
  }

  return result;
}

function drawAircraftLabels(params: RadarDrawParams, renderData: Map<string, AircraftRenderData>) {
  const { ctx, width, height, aircraft, theme, labelConditions, pinnedHexes, zoomLevel, panOffset } = params;
  const textColor = theme === 'dark' ? '#e5e7eb' : '#1f2937';
  const s = iconScaleForZoom(zoomLevel);
  const labelW = LABEL_W * s;
  const labelH = LABEL_H * s;
  const pad = 7 * s;
  const r = 5 * s;

  const placements = computeLabelPositions(
    { width, height, aircraft, pinnedHexes, labelConditions, panOffset, zoomLevel },
    renderData,
    s,
  );

  for (const ac of aircraft) {
    const placement = placements.get(ac.hex);
    if (!placement) continue;
    const rd = renderData.get(ac.hex)!;
    const { pos, color } = rd;
    const { lx, ly, opacity, connX, connY } = placement;
    const callsign = ac.flight ?? ac.hex;
    const phase = ac.phase;
    const phaseColor = getPhaseColor(phase);

    // Connector line
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = opacity * 0.6;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(connX, connY);
    ctx.stroke();
    ctx.restore();

    // Label box + all text
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = opacity;

    // Background
    ctx.fillStyle = theme === 'dark' ? 'rgba(10, 11, 15, 0.82)' : 'rgba(240, 242, 248, 0.92)';
    ctx.beginPath();
    ctx.roundRect(lx, ly, labelW, labelH, r);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Callsign
    ctx.fillStyle = color;
    ctx.font = `bold ${9.5 * s}px monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(callsign, lx + pad, ly + pad);

    // Altitude
    const altText = `${ac.alt_baro.toLocaleString()} ft`;
    ctx.fillStyle = textColor;
    ctx.font = `${8.5 * s}px monospace`;
    ctx.fillText(altText, lx + pad, ly + pad + 15 * s);

    // Trend arrow
    const trendArrow = ac.baro_rate > 100 ? '▲' : ac.baro_rate < -100 ? '▼' : '—';
    const trendColor = ac.baro_rate > 100 ? '#4ade80' : ac.baro_rate < -100 ? '#f87171' : '#9ca3af';
    const altWidth = ctx.measureText(altText).width;
    ctx.fillStyle = trendColor;
    ctx.font = `bold ${10 * s}px monospace`;
    ctx.fillText(trendArrow, lx + pad + altWidth + 3 * s, ly + pad + 14 * s);

    // Speed
    ctx.fillStyle = '#9ca3af';
    ctx.font = `${8 * s}px monospace`;
    ctx.fillText(`${Math.round(ac.gs)} kts`, lx + pad, ly + pad + 29 * s);

    // Phase badge
    const BADGE_W = 28 * s;
    const BADGE_H = 12 * s;
    const badgeX = lx + labelW - BADGE_W - 5 * s;
    const badgeY = ly + labelH - BADGE_H - 4 * s;

    ctx.fillStyle = phaseColor + '33';
    ctx.strokeStyle = phaseColor + '80';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, BADGE_W, BADGE_H, 3 * s);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = phaseColor;
    ctx.font = `${7 * s}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(phase, badgeX + BADGE_W / 2, badgeY + BADGE_H / 2);

    ctx.restore();
  }
}
