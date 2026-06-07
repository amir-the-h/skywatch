# Radar Visual Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three visual features to the radar view: filled silhouettes for selected aircraft, a color-coded pinned card with route data, and persistent floating labels on every aircraft.

**Architecture:** Phase inference is a pure function extracted to `src/lib/flightPhase.ts` for testability. Canvas labels are drawn in a new `drawAircraftLabels` call at the end of each frame in `RadarCanvas.ts`. `FlightBubble` receives an aircraft color prop so the callsign and border reflect the per-aircraft color.

**Tech Stack:** React 18, TypeScript, HTML Canvas (rAF loop), Vitest, Zustand

---

## File Map

| File | Role |
|------|------|
| `src/types/aircraft.ts` | Add `orig_iata?`, `dest_iata?`, `orig_name?`, `dest_name?` |
| `src/api/airplanesLive.ts` | Normalize route fields + fix `alt_baro: "ground"` edge case |
| `src/lib/flightPhase.ts` | **New** — pure `inferFlightPhase(ac)` → badge string |
| `src/lib/flightPhase.test.ts` | **New** — unit tests for every phase branch |
| `src/components/RadarView/RadarCanvas.ts` | Split hover/pin rendering; add `drawAircraftLabels` |
| `src/components/RadarView/RadarView.tsx` | Pass `color` prop to `FlightBubble` |
| `src/components/FlightBubble/FlightBubble.tsx` | Accept `color`; colored callsign + left border + route row |
| `src/index.css` | Add `.bubble-route` and `.route-cities` styles |

---

### Task 1: Add route fields to Aircraft type

**Files:**
- Modify: `src/types/aircraft.ts`

- [ ] **Step 1: Add four optional route fields to the Aircraft interface**

Open `src/types/aircraft.ts` and add after `year?: string;`:

```ts
orig_iata?: string;
dest_iata?: string;
orig_name?: string;
dest_name?: string;
```

Final Aircraft interface (only new lines shown in context):

```ts
export interface Aircraft {
  hex: string;
  flight: string;
  r: string;
  t: string;
  lat: number;
  lon: number;
  alt_baro: number;
  gs: number;
  track: number;
  baro_rate: number;
  mach?: number;
  squawk?: string;
  emergency?: string;
  nav_altitude_mcp?: number;
  nav_heading?: number;
  nav_modes?: string[];
  ownOp?: string;
  year?: string;
  orig_iata?: string;   // ← new
  dest_iata?: string;   // ← new
  orig_name?: string;   // ← new
  dest_name?: string;   // ← new
  seen: number;
  _renderLat: number;
  _renderLon: number;
  _lastSeen: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/aircraft.ts
git commit -m "feat: add route fields to Aircraft type"
```

---

### Task 2: Update API normalizer — route fields + alt_baro "ground" fix

**Files:**
- Modify: `src/api/airplanesLive.ts`
- Modify: `src/api/airplanesLive.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/api/airplanesLive.test.ts` inside the `describe('fetchAircraft')` block:

```ts
it('normalizes route fields when present', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ac: [{
          hex: 'abc123', flight: 'TK1', r: 'TC-A', t: 'B738',
          lat: 41, lon: 28, alt_baro: 35000, gs: 450, track: 0,
          baro_rate: 0, seen: 1,
          orig_iata: 'IST', dest_iata: 'AYT',
          orig_name: 'Istanbul', dest_name: 'Antalya',
        }],
      }),
    })
  );
  const result = await fetchAircraft(41, 28, 100);
  expect(result[0].orig_iata).toBe('IST');
  expect(result[0].dest_iata).toBe('AYT');
  expect(result[0].orig_name).toBe('Istanbul');
  expect(result[0].dest_name).toBe('Antalya');
});

it('normalizes route fields to undefined when absent', async () => {
  const result = await fetchAircraft(41, 28, 100);
  expect(result[0].orig_iata).toBeUndefined();
  expect(result[0].dest_iata).toBeUndefined();
});

it('treats alt_baro "ground" as 0', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ac: [{
          hex: 'abc123', flight: 'TK1', r: 'TC-A', t: 'B738',
          lat: 41, lon: 28, alt_baro: 'ground', gs: 5, track: 0,
          baro_rate: 0, seen: 1,
        }],
      }),
    })
  );
  const result = await fetchAircraft(41, 28, 100);
  expect(result[0].alt_baro).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose src/api/airplanesLive.test.ts
```

Expected: 3 new tests fail.

- [ ] **Step 3: Update the normalizer**

Replace the `normalize` function in `src/api/airplanesLive.ts`:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(raw: any): Aircraft | null {
  if (raw.lat == null || raw.lon == null) return null;
  return {
    hex: raw.hex ?? '',
    flight: (raw.flight ?? '').trim(),
    r: raw.r ?? '',
    t: raw.t ?? '',
    lat: raw.lat,
    lon: raw.lon,
    alt_baro: typeof raw.alt_baro === 'number' ? raw.alt_baro : 0,
    gs: raw.gs ?? 0,
    track: raw.track ?? 0,
    baro_rate: raw.baro_rate ?? 0,
    mach: raw.mach,
    squawk: raw.squawk,
    emergency: raw.emergency,
    nav_altitude_mcp: raw.nav_altitude_mcp,
    nav_heading: raw.nav_heading,
    nav_modes: raw.nav_modes,
    ownOp: raw.ownOp,
    year: raw.year,
    orig_iata: raw.orig_iata ?? undefined,
    dest_iata: raw.dest_iata ?? undefined,
    orig_name: raw.orig_name ?? undefined,
    dest_name: raw.dest_name ?? undefined,
    seen: raw.seen ?? 0,
    _renderLat: raw.lat,
    _renderLon: raw.lon,
    _lastSeen: 0,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose src/api/airplanesLive.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/api/airplanesLive.ts src/api/airplanesLive.test.ts
git commit -m "feat: normalize route fields and fix alt_baro ground string"
```

---

### Task 3: Extract flight phase inference

**Files:**
- Create: `src/lib/flightPhase.ts`
- Create: `src/lib/flightPhase.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/flightPhase.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { inferFlightPhase } from './flightPhase';
import type { Aircraft } from '../types/aircraft';

function ac(overrides: Partial<Aircraft>): Aircraft {
  return {
    hex: 'aaa', flight: 'TK1', r: 'TC-A', t: 'B738',
    lat: 41, lon: 28, alt_baro: 10000, gs: 400, track: 0,
    baro_rate: 0, seen: 1,
    _renderLat: 41, _renderLon: 28, _lastSeen: 0,
    ...overrides,
  };
}

describe('inferFlightPhase', () => {
  it('returns TXI when low alt and taxiing speed', () => {
    expect(inferFlightPhase(ac({ alt_baro: 200, gs: 25, baro_rate: 0 }))).toBe('TXI');
  });

  it('returns GND when very low alt and nearly stopped', () => {
    expect(inferFlightPhase(ac({ alt_baro: 100, gs: 2, baro_rate: 0 }))).toBe('GND');
  });

  it('returns T/O when below 3000ft and climbing fast', () => {
    expect(inferFlightPhase(ac({ alt_baro: 2000, gs: 160, baro_rate: 1500 }))).toBe('T/O');
  });

  it('returns APP when below 5000ft and descending', () => {
    expect(inferFlightPhase(ac({ alt_baro: 3000, gs: 180, baro_rate: -600 }))).toBe('APP');
  });

  it('returns CLB when climbing in cruise band', () => {
    expect(inferFlightPhase(ac({ alt_baro: 20000, baro_rate: 500 }))).toBe('CLB');
  });

  it('returns DSC when descending in cruise band', () => {
    expect(inferFlightPhase(ac({ alt_baro: 20000, baro_rate: -500 }))).toBe('DSC');
  });

  it('returns CRZ when level at cruise altitude', () => {
    expect(inferFlightPhase(ac({ alt_baro: 35000, baro_rate: 50 }))).toBe('CRZ');
  });

  it('TXI takes priority over GND when gs is in 5-50 range', () => {
    expect(inferFlightPhase(ac({ alt_baro: 0, gs: 10, baro_rate: 0 }))).toBe('TXI');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose src/lib/flightPhase.test.ts
```

Expected: all 8 tests fail (module not found).

- [ ] **Step 3: Implement flightPhase.ts**

Create `src/lib/flightPhase.ts`:

```ts
import type { Aircraft } from '../types/aircraft';

export type FlightPhase = 'TXI' | 'GND' | 'T/O' | 'APP' | 'CLB' | 'DSC' | 'CRZ';

export function inferFlightPhase(ac: Aircraft): FlightPhase {
  const alt = ac.alt_baro;
  const gs = ac.gs;
  const rate = ac.baro_rate;

  if (alt <= 500 && gs >= 5 && gs <= 50) return 'TXI';
  if (alt <= 500 && gs < 5) return 'GND';
  if (alt < 3000 && rate > 1000) return 'T/O';
  if (alt < 5000 && rate < -300) return 'APP';
  if (rate > 200) return 'CLB';
  if (rate < -200) return 'DSC';
  return 'CRZ';
}

export function getPhaseColor(phase: FlightPhase): string {
  switch (phase) {
    case 'CLB': case 'T/O': return '#4ade80';
    case 'DSC': case 'APP': return '#f87171';
    default: return '#9ca3af';
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose src/lib/flightPhase.test.ts
```

Expected: all 8 pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/flightPhase.ts src/lib/flightPhase.test.ts
git commit -m "feat: add flight phase inference utility"
```

---

### Task 4: Update RadarCanvas — pinned fill + floating labels

**Files:**
- Modify: `src/components/RadarView/RadarCanvas.ts`

- [ ] **Step 1: Add imports and update `drawAllAircraft` to split hover/pin rendering**

Replace the full `src/components/RadarView/RadarCanvas.ts` with the following. Changes from current:
- Import `inferFlightPhase` and `getPhaseColor`
- Split `isHighlighted` into `isPinned` and `isHovered`
- Fill silhouette when `isPinned`
- Add `drawAircraftLabels` function
- Call `drawAircraftLabels` from `drawRadar`

```ts
// src/components/RadarView/RadarCanvas.ts
import type { Aircraft } from '../../types/aircraft';
import { aircraftColor, lightenHsl } from '../../lib/colorSystem';
import { getAircraftFamily, SILHOUETTE_PATHS } from '../../lib/silhouettes';
import { latLonToCanvas } from '../../lib/geoUtils';
import { inferFlightPhase, getPhaseColor } from '../../lib/flightPhase';

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
  drawAllAircraft(params);
  drawAircraftLabels(params);
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

function drawAllAircraft(params: RadarDrawParams) {
  const { ctx, width, height, centerLat, centerLon, radiusKm, aircraft, hoveredHex, pinnedHexes, theme, pathHistory } = params;

  for (const ac of aircraft) {
    const pos = latLonToCanvas(ac._renderLat, ac._renderLon, centerLat, centerLon, radiusKm, width, height);
    if (pos.x < -20 || pos.x > width + 20 || pos.y < -20 || pos.y > height + 20) continue;

    const color = aircraftColor(ac.t, theme);
    const family = getAircraftFamily(ac.t);
    const pathStr = SILHOUETTE_PATHS[family];
    const isPinned = pinnedHexes.has(ac.hex);
    const isHovered = hoveredHex === ac.hex && !isPinned;
    const isEmergency = (!!ac.emergency && ac.emergency !== 'none') || ac.squawk === '7700' || ac.squawk === '7600' || ac.squawk === '7500';

    // Trail
    const history = pathHistory.get(ac.hex);
    if (history && history.length >= 2) {
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
}

const LABEL_W = 100;
const LABEL_H = 52;
const LABEL_OFFSET = 40;

function drawAircraftLabels(params: RadarDrawParams) {
  const { ctx, width, height, centerLat, centerLon, radiusKm, aircraft, theme } = params;
  const textColor = theme === 'dark' ? '#e5e7eb' : '#1f2937';

  for (const ac of aircraft) {
    const pos = latLonToCanvas(ac._renderLat, ac._renderLon, centerLat, centerLon, radiusKm, width, height);
    if (pos.x < -20 || pos.x > width + 20 || pos.y < -20 || pos.y > height + 20) continue;

    const color = aircraftColor(ac.t, theme);
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
    ctx.setLineDash([]);
    ctx.restore();

    // Label background
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(10, 11, 15, 0.82)';
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
```

- [ ] **Step 2: Run existing tests to confirm nothing broke**

```bash
npm test
```

Expected: all existing tests pass (canvas code has no unit tests; this is a visual change).

- [ ] **Step 3: Commit**

```bash
git add src/components/RadarView/RadarCanvas.ts
git commit -m "feat: fill pinned aircraft silhouettes and add floating canvas labels"
```

---

### Task 5: Update FlightBubble — color prop, callsign color, left border, route row

**Files:**
- Modify: `src/components/FlightBubble/FlightBubble.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Update FlightBubble component**

Replace `src/components/FlightBubble/FlightBubble.tsx`:

```tsx
// src/components/FlightBubble/FlightBubble.tsx
import { useState } from 'react';
import type { Aircraft } from '../../types/aircraft';
import { useAircraftStore } from '../../store/aircraftStore';

const EMERGENCY_LABELS: Record<string, string> = {
  '7700': 'General Emergency',
  'general': 'General Emergency',
  '7600': 'Radio Failure (NORDO)',
  'nordo': 'Radio Failure (NORDO)',
  '7500': 'Hijacking',
  'unlawful': 'Hijacking',
  'lifeguard': 'Medical Emergency',
  'minfuel': 'Minimum Fuel',
  'downed': 'Downed Aircraft',
};

function getEmergencyLabel(aircraft: Aircraft): string | null {
  const sq = aircraft.squawk ?? '';
  const em = aircraft.emergency ?? '';
  return EMERGENCY_LABELS[sq] ?? EMERGENCY_LABELS[em] ?? null;
}

interface Props {
  aircraft: Aircraft;
  color: string;
}

export function FlightBubble({ aircraft, color }: Props) {
  const unpin = useAircraftStore((s) => s.unpin);
  const [autopilotOpen, setAutopilotOpen] = useState(false);
  const emergencyLabel = getEmergencyLabel(aircraft);
  const hasRoute = !!(aircraft.orig_iata || aircraft.dest_iata);

  return (
    <div
      className={`flight-bubble ${emergencyLabel ? 'emergency' : ''}`}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      {emergencyLabel && (
        <div className="emergency-banner">{emergencyLabel}</div>
      )}

      <div className="bubble-header">
        <div>
          <strong style={{ color }}>{aircraft.flight || aircraft.hex}</strong>
          {aircraft.r && <span className="reg"> · {aircraft.r}</span>}
        </div>
        <button className="icon-btn" onClick={() => unpin(aircraft.hex)} aria-label="Close">✕</button>
      </div>

      <div className="bubble-type">
        {aircraft.t}{aircraft.year ? ` · ${aircraft.year}` : ''}{aircraft.ownOp ? ` · ${aircraft.ownOp}` : ''}
      </div>

      {hasRoute && (
        <div className="bubble-route" style={{ borderColor: `${color}33`, background: `${color}12` }}>
          <span className="route-codes">
            {aircraft.orig_iata ?? '?'}
            <span className="route-arrow"> → </span>
            {aircraft.dest_iata ?? '?'}
          </span>
          {(aircraft.orig_name || aircraft.dest_name) && (
            <div className="route-cities">
              {[aircraft.orig_name, aircraft.dest_name].filter(Boolean).join(' → ')}
            </div>
          )}
        </div>
      )}

      <div className="bubble-section">
        <div className="bubble-row">
          {aircraft.alt_baro.toLocaleString()} ft
          {aircraft.baro_rate !== 0 && (
            <span className={aircraft.baro_rate > 0 ? 'climb' : 'descend'}>
              {' '}{aircraft.baro_rate > 0 ? '▲' : '▼'} {Math.abs(aircraft.baro_rate)} fpm
            </span>
          )}
        </div>
        <div className="bubble-row">
          {Math.round(aircraft.gs)} kts · {Math.round(aircraft.track)}°
          {aircraft.mach != null && ` · M${aircraft.mach.toFixed(2)}`}
        </div>
        {aircraft.squawk && (
          <div className="bubble-row">Squawk {aircraft.squawk}</div>
        )}
        <div className="bubble-row muted">{aircraft.seen}s ago</div>
      </div>

      {(aircraft.nav_altitude_mcp != null || aircraft.nav_heading != null || aircraft.nav_modes?.length) && (
        <details
          className="bubble-autopilot"
          open={autopilotOpen}
          onToggle={(e) => setAutopilotOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary>▼ Autopilot</summary>
          {aircraft.nav_altitude_mcp != null && (
            <div className="bubble-row">Target alt: {aircraft.nav_altitude_mcp.toLocaleString()} ft</div>
          )}
          {aircraft.nav_heading != null && (
            <div className="bubble-row">Sel heading: {Math.round(aircraft.nav_heading)}°</div>
          )}
          {aircraft.nav_modes?.length && (
            <div className="bubble-row">Modes: {aircraft.nav_modes.join(', ')}</div>
          )}
        </details>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add route row CSS to index.css**

Append to `src/index.css` (after the `.bubble-autopilot summary` block, before the modal section):

```css
/* ─── Route row in pinned bubble ─── */
.bubble-route {
  border: 1px solid;
  border-radius: 5px;
  padding: 5px 10px;
  margin-bottom: 8px;
  font-family: monospace;
  font-size: 11px;
}

.route-codes {
  color: var(--text-muted);
  font-size: 12px;
}

.route-arrow {
  color: var(--text-muted);
}

.route-cities {
  color: var(--text-muted);
  font-size: 10px;
  margin-top: 2px;
  opacity: 0.7;
}
```

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests pass (FlightBubble has no unit tests; this is a visual/prop-signature change).

- [ ] **Step 4: Commit**

```bash
git add src/components/FlightBubble/FlightBubble.tsx src/index.css
git commit -m "feat: color callsign, add left border and route row to pinned card"
```

---

### Task 6: Wire color prop in RadarView

**Files:**
- Modify: `src/components/RadarView/RadarView.tsx`

- [ ] **Step 1: Import aircraftColor and pass color to FlightBubble**

In `src/components/RadarView/RadarView.tsx`:

1. Add import at top:

```ts
import { aircraftColor } from '../../lib/colorSystem';
```

2. Replace the `bubbles-container` div:

```tsx
<div className="bubbles-container">
  {[...pinnedHexes].map((hex) => {
    const ac = aircraftMap.get(hex);
    if (!ac) return null;
    const color = aircraftColor(ac.t, theme);
    return <FlightBubble key={hex} aircraft={ac} color={color} />;
  })}
</div>
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/RadarView/RadarView.tsx
git commit -m "feat: pass aircraft color to FlightBubble in RadarView"
```

---

### Task 7: Verify visually in the app

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open `http://localhost:5173` in a browser.

- [ ] **Step 2: Check floating labels**

Switch to Radar view. Every aircraft should have a small label box connected by a dashed line showing callsign, altitude with trend arrow, speed in knots, and a phase badge (CRZ for most airborne aircraft).

- [ ] **Step 3: Check selected aircraft fill**

Click an aircraft to pin it. The silhouette should fill with its color at ~55% opacity. The floating label for that aircraft should still appear.

- [ ] **Step 4: Check pinned card**

The pinned side card should show the callsign in the aircraft's color, a left border in that color, and a route row if the API returned origin/destination data.

- [ ] **Step 5: Pin multiple aircraft**

Pin 2–3 aircraft. Verify each card has a distinct color matching its silhouette on the radar.

- [ ] **Step 6: Final commit if any CSS tweaks were needed**

```bash
git add -p
git commit -m "fix: visual tweaks after manual verification"
```
