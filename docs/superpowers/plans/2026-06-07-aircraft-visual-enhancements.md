# Aircraft Visual Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add filled aircraft icons on the map, a dotted heading line from the nose, and a solid position trail to both the radar canvas and map views.

**Architecture:** Position history is stored in the Zustand store (capped at 50 per aircraft). Two new pure helpers (`bearingToLatLon`, `lightenHsl`) are added to existing lib files. Canvas rendering is extended inline in `RadarCanvas.ts`. Map rendering adds a new `AircraftOverlay` component that renders Leaflet Polylines alongside each `AircraftMarker`.

**Tech Stack:** React, TypeScript, Zustand, Leaflet / react-leaflet, Vitest, HTML Canvas API

---

## File Map

| File | Change |
|------|--------|
| `src/lib/geoUtils.ts` | Add `bearingToLatLon` |
| `src/lib/geoUtils.test.ts` | Add tests for `bearingToLatLon` |
| `src/lib/colorSystem.ts` | Add `lightenHsl` |
| `src/lib/colorSystem.test.ts` | Add tests for `lightenHsl` |
| `src/store/aircraftStore.ts` | Add `pathHistory` field + update logic |
| `src/store/aircraftStore.test.ts` | Create — test `pathHistory` behaviour |
| `src/components/RadarView/RadarCanvas.ts` | Add `pathHistory` to `RadarDrawParams`, draw trail + heading line |
| `src/components/RadarView/RadarView.tsx` | Pass `pathHistory` to `drawRadar` |
| `src/components/MapView/AircraftMarker.tsx` | Change SVG `fill="none"` → filled with aircraft color |
| `src/components/MapView/AircraftOverlay.tsx` | Create — heading + trail Polylines |
| `src/components/MapView/MapView.tsx` | Render `<AircraftOverlay>` alongside each `<AircraftMarker>` |

---

## Task 1: Add `bearingToLatLon` to `geoUtils`

**Files:**
- Modify: `src/lib/geoUtils.ts`
- Modify: `src/lib/geoUtils.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/geoUtils.test.ts`:

```ts
import { haversineKm, boundingBox, latLonToCanvas, bearingToLatLon } from './geoUtils';

describe('bearingToLatLon', () => {
  it('returns the same point for distance 0', () => {
    const result = bearingToLatLon(41, 28, 90, 0);
    expect(result.lat).toBeCloseTo(41, 5);
    expect(result.lon).toBeCloseTo(28, 5);
  });

  it('heading north moves latitude up', () => {
    const result = bearingToLatLon(41, 28, 0, 111);
    expect(result.lat).toBeCloseTo(42, 0);
    expect(result.lon).toBeCloseTo(28, 0);
  });

  it('heading east moves longitude right', () => {
    const result = bearingToLatLon(0, 0, 90, 111);
    expect(result.lon).toBeGreaterThan(0);
    expect(result.lat).toBeCloseTo(0, 0);
  });

  it('result is ~distanceKm away from origin', () => {
    const result = bearingToLatLon(41, 28, 45, 50);
    expect(haversineKm(41, 28, result.lat, result.lon)).toBeCloseTo(50, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /mnt/storage/shared/projects/personal/flight-tracker
npx vitest run src/lib/geoUtils.test.ts
```

Expected: FAIL — `bearingToLatLon is not a function`

- [ ] **Step 3: Implement `bearingToLatLon`**

Add to the bottom of `src/lib/geoUtils.ts`:

```ts
export function bearingToLatLon(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceKm: number
): { lat: number; lon: number } {
  const d = distanceKm / R_KM;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
    Math.cos(lat1) * Math.sin(d) * Math.cos(bearing)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: (lat2 * 180) / Math.PI,
    lon: (lon2 * 180) / Math.PI,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/geoUtils.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/geoUtils.ts src/lib/geoUtils.test.ts
git commit -m "feat: add bearingToLatLon geo helper"
```

---

## Task 2: Add `lightenHsl` to `colorSystem`

**Files:**
- Modify: `src/lib/colorSystem.ts`
- Modify: `src/lib/colorSystem.test.ts`

`aircraftColor` returns `hsl(H, S%, L%)` strings. `lightenHsl` bumps the lightness component by `amount * 100` percentage points, clamped to 100.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/colorSystem.test.ts`:

```ts
import { aircraftColor, getManufacturer, lightenHsl } from './colorSystem';

describe('lightenHsl', () => {
  it('increases lightness by the given fraction', () => {
    const result = lightenHsl('hsl(120, 90%, 55%)', 0.2);
    expect(result).toBe('hsl(120, 90%, 75%)');
  });

  it('clamps lightness at 100%', () => {
    const result = lightenHsl('hsl(120, 90%, 95%)', 0.2);
    expect(result).toBe('hsl(120, 90%, 100%)');
  });

  it('returns the input unchanged if not a valid hsl string', () => {
    expect(lightenHsl('not-a-color', 0.2)).toBe('not-a-color');
  });

  it('produces a valid hsl string for aircraft colors', () => {
    const base = aircraftColor('B738', 'dark');
    const bright = lightenHsl(base, 0.2);
    expect(bright).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/colorSystem.test.ts
```

Expected: FAIL — `lightenHsl is not a function`

- [ ] **Step 3: Implement `lightenHsl`**

Add to the bottom of `src/lib/colorSystem.ts`:

```ts
export function lightenHsl(hslStr: string, amount: number): string {
  const m = hslStr.match(/^hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)$/);
  if (!m) return hslStr;
  const [, h, s, l] = m.map(Number);
  const newL = Math.min(100, l + Math.round(amount * 100));
  return `hsl(${h}, ${s}%, ${newL}%)`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/colorSystem.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/colorSystem.ts src/lib/colorSystem.test.ts
git commit -m "feat: add lightenHsl color helper"
```

---

## Task 3: Add `pathHistory` to `aircraftStore`

**Files:**
- Modify: `src/store/aircraftStore.ts`
- Create: `src/store/aircraftStore.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/store/aircraftStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAircraftStore } from './aircraftStore';
import type { Aircraft } from '../types/aircraft';

function makeAc(hex: string, lat: number, lon: number): Aircraft {
  return {
    hex, flight: hex, r: hex, t: 'B738',
    lat, lon, alt_baro: 10000, gs: 400, track: 90,
    baro_rate: 0, seen: 1,
    _renderLat: lat, _renderLon: lon, _lastSeen: Date.now(),
  };
}

beforeEach(() => {
  useAircraftStore.setState({
    aircraft: new Map(),
    pathHistory: new Map(),
    pinnedHexes: new Set(),
    hoveredHex: null,
    lastUpdated: null,
  });
});

describe('pathHistory', () => {
  it('records a position on first merge', () => {
    useAircraftStore.getState().mergeAircraft([makeAc('ABC123', 41, 28)]);
    const history = useAircraftStore.getState().pathHistory.get('ABC123');
    expect(history).toHaveLength(1);
    expect(history![0]).toEqual({ lat: 41, lon: 28 });
  });

  it('appends positions on subsequent merges', () => {
    useAircraftStore.getState().mergeAircraft([makeAc('ABC123', 41, 28)]);
    useAircraftStore.getState().mergeAircraft([makeAc('ABC123', 41.1, 28.1)]);
    const history = useAircraftStore.getState().pathHistory.get('ABC123');
    expect(history).toHaveLength(2);
    expect(history![1]).toEqual({ lat: 41.1, lon: 28.1 });
  });

  it('caps history at 50 entries', () => {
    for (let i = 0; i < 60; i++) {
      useAircraftStore.getState().mergeAircraft([makeAc('ABC123', 41 + i * 0.01, 28)]);
    }
    const history = useAircraftStore.getState().pathHistory.get('ABC123');
    expect(history).toHaveLength(50);
    // oldest entries are dropped — newest lat is 41 + 59 * 0.01
    expect(history![49].lat).toBeCloseTo(41 + 59 * 0.01, 3);
  });

  it('removes history for stale aircraft', () => {
    useAircraftStore.getState().mergeAircraft([makeAc('ABC123', 41, 28)]);
    useAircraftStore.getState().removeStale(new Set());
    expect(useAircraftStore.getState().pathHistory.has('ABC123')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/store/aircraftStore.test.ts
```

Expected: FAIL — `pathHistory` not on store state

- [ ] **Step 3: Add `pathHistory` to the store**

Replace `src/store/aircraftStore.ts` with:

```ts
// src/store/aircraftStore.ts
import { create } from 'zustand';
import type { Aircraft } from '../types/aircraft';

const PATH_HISTORY_MAX = 50;

interface AircraftStore {
  aircraft: Map<string, Aircraft>;
  pathHistory: Map<string, { lat: number; lon: number }[]>;
  pinnedHexes: Set<string>;
  hoveredHex: string | null;
  lastUpdated: number | null;

  mergeAircraft: (incoming: Aircraft[]) => void;
  removeStale: (hexes: Set<string>) => void;
  pin: (hex: string) => void;
  unpin: (hex: string) => void;
  setHovered: (hex: string | null) => void;
}

export const useAircraftStore = create<AircraftStore>((set) => ({
  aircraft: new Map(),
  pathHistory: new Map(),
  pinnedHexes: new Set(),
  hoveredHex: null,
  lastUpdated: null,

  mergeAircraft: (incoming) =>
    set((state) => {
      const next = new Map(state.aircraft);
      const nextHistory = new Map(state.pathHistory);
      const now = Date.now();
      for (const ac of incoming) {
        const prev = next.get(ac.hex);
        next.set(ac.hex, {
          ...ac,
          _renderLat: prev ? prev._renderLat : ac.lat,
          _renderLon: prev ? prev._renderLon : ac.lon,
          _lastSeen: now,
        });
        const existing = nextHistory.get(ac.hex) ?? [];
        const updated = [...existing, { lat: ac.lat, lon: ac.lon }];
        nextHistory.set(ac.hex, updated.slice(-PATH_HISTORY_MAX));
      }
      return { aircraft: next, pathHistory: nextHistory, lastUpdated: now };
    }),

  removeStale: (activeHexes) =>
    set((state) => {
      const next = new Map(state.aircraft);
      const nextHistory = new Map(state.pathHistory);
      for (const hex of next.keys()) {
        if (!activeHexes.has(hex)) {
          next.delete(hex);
          nextHistory.delete(hex);
        }
      }
      const newPinned = new Set([...state.pinnedHexes].filter((h) => next.has(h)));
      return { aircraft: next, pathHistory: nextHistory, pinnedHexes: newPinned };
    }),

  pin: (hex) =>
    set((s) => ({ pinnedHexes: new Set([...s.pinnedHexes, hex]) })),

  unpin: (hex) =>
    set((s) => {
      const next = new Set(s.pinnedHexes);
      next.delete(hex);
      return { pinnedHexes: next };
    }),

  setHovered: (hex) => set({ hoveredHex: hex }),
}));
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/store/aircraftStore.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/aircraftStore.ts src/store/aircraftStore.test.ts
git commit -m "feat: track aircraft position history in store (capped at 50)"
```

---

## Task 4: Canvas — draw trail and heading line

**Files:**
- Modify: `src/components/RadarView/RadarCanvas.ts`
- Modify: `src/components/RadarView/RadarView.tsx`

The silhouette viewBox is `-50 -100 100 200` with nose at (0, ~-85). After `ctx.scale(AIRCRAFT_SIZE/200, AIRCRAFT_SIZE/200)`, the nose is `AIRCRAFT_SIZE * 0.425` px above the center in local (pre-rotation) space. Lines are drawn in world canvas space (after `ctx.restore()`), using trig from the known heading.

- [ ] **Step 1: Update `RadarDrawParams` and `drawAllAircraft`**

Replace the contents of `src/components/RadarView/RadarCanvas.ts`:

```ts
// src/components/RadarView/RadarCanvas.ts
import type { Aircraft } from '../../types/aircraft';
import { aircraftColor, lightenHsl } from '../../lib/colorSystem';
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
  pathHistory: Map<string, { lat: number; lon: number }[]>;
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
// Nose tip is at ~y=-85 in the viewBox "-50 -100 100 200".
// After scale(AIRCRAFT_SIZE/200) the nose is AIRCRAFT_SIZE*0.425 px above center.
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
    const isHighlighted = hoveredHex === ac.hex || pinnedHexes.has(ac.hex);
    const isEmergency = (!!ac.emergency && ac.emergency !== 'none') || ac.squawk === '7700' || ac.squawk === '7600' || ac.squawk === '7500';

    // Trail — drawn first so it appears under the aircraft
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
        const p = latLonToCanvas(lat, lon, centerLat, centerLon, radiusKm, width, height);
        if (first) { ctx.moveTo(p.x, p.y); first = false; }
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Silhouette — outline only
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate((ac.track * Math.PI) / 180);
    ctx.scale(AIRCRAFT_SIZE / 200, AIRCRAFT_SIZE / 200);

    const p = new Path2D(pathStr);
    ctx.shadowColor = color;
    ctx.shadowBlur = isEmergency ? 35 : isHighlighted ? 20 : 8;
    ctx.strokeStyle = color;
    ctx.lineWidth = isEmergency ? 6 : isHighlighted ? 5 : 3;
    ctx.stroke(p);
    ctx.restore();

    // Heading line — from nose tip forward
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
```

- [ ] **Step 2: Pass `pathHistory` from `RadarView`**

In `src/components/RadarView/RadarView.tsx`, add the store subscription and pass `pathHistory` to `drawRadar`:

After the line `const hoveredHex = useAircraftStore((s) => s.hoveredHex);`, add:

```ts
const pathHistory = useAircraftStore((s) => s.pathHistory);
```

Inside the `drawRadar({...})` call (around line 71–83), add `pathHistory` to the object:

```ts
drawRadar({
  ctx,
  width: canvas.width,
  height: canvas.height,
  centerLat: effectiveLat,
  centerLon: effectiveLon,
  radiusKm: effectiveRadius,
  ringIntervals,
  aircraft,
  hoveredHex: hoveredHexRef.current,
  pinnedHexes: pinnedHexesRef.current,
  theme,
  pathHistory,
});
```

Also update the `useEffect` dependency array (line 89) to include `pathHistory`:

```ts
}, [lat, lng, radiusKm, ringIntervals, theme, aircraftMap, pathHistory]);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/RadarView/RadarCanvas.ts src/components/RadarView/RadarView.tsx
git commit -m "feat: add trail and heading line to radar canvas view"
```

---

## Task 5: Map view — fill aircraft silhouette

**Files:**
- Modify: `src/components/MapView/AircraftMarker.tsx`

Change the SVG path from `fill="none"` to filled with the aircraft color at 60% opacity.

- [ ] **Step 1: Update the SVG path fill**

In `src/components/MapView/AircraftMarker.tsx`, find the `<path` element inside the `html` template literal (around line 48–53) and change:

```html
<path
  d="${path}"
  fill="none"
  stroke="${color}"
  stroke-width="3"
  filter="url(#glow-${aircraft.hex})"
/>
```

to:

```html
<path
  d="${path}"
  fill="${color}"
  fill-opacity="0.6"
  stroke="${color}"
  stroke-width="3"
  filter="url(#glow-${aircraft.hex})"
/>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/MapView/AircraftMarker.tsx
git commit -m "feat: fill aircraft silhouette with color in map view"
```

---

## Task 6: Create `AircraftOverlay` component

**Files:**
- Create: `src/components/MapView/AircraftOverlay.tsx`

Renders a dashed heading Polyline and a solid trail Polyline for one aircraft using react-leaflet primitives.

- [ ] **Step 1: Create the component**

Create `src/components/MapView/AircraftOverlay.tsx`:

```tsx
// src/components/MapView/AircraftOverlay.tsx
import { Polyline } from 'react-leaflet';
import type { Aircraft } from '../../types/aircraft';
import { aircraftColor } from '../../lib/colorSystem';
import { lightenHsl } from '../../lib/colorSystem';
import { bearingToLatLon } from '../../lib/geoUtils';
import { useAircraftStore } from '../../store/aircraftStore';
import { useSettingsStore } from '../../hooks/useSettings';

interface Props {
  aircraft: Aircraft;
}

const HEADING_KM = 5;

export function AircraftOverlay({ aircraft }: Props) {
  const theme = useSettingsStore((s) => s.theme);
  const pathHistory = useAircraftStore((s) => s.pathHistory);

  const color = aircraftColor(aircraft.t, theme);
  const trailColor = lightenHsl(color, 0.2);
  const history = pathHistory.get(aircraft.hex) ?? [];

  const hasTrack = aircraft.track != null && !Number.isNaN(aircraft.track);
  const headingEnd = hasTrack
    ? bearingToLatLon(aircraft._renderLat, aircraft._renderLon, aircraft.track, HEADING_KM)
    : null;

  return (
    <>
      {history.length >= 2 && (
        <Polyline
          positions={history.map((p) => [p.lat, p.lon] as [number, number])}
          color={trailColor}
          weight={1.5}
          opacity={0.9}
        />
      )}
      {headingEnd && (
        <Polyline
          positions={[
            [aircraft._renderLat, aircraft._renderLon],
            [headingEnd.lat, headingEnd.lon],
          ]}
          color={color}
          weight={1.5}
          opacity={0.8}
          dashArray="5 8"
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/MapView/AircraftOverlay.tsx
git commit -m "feat: add AircraftOverlay component for heading and trail polylines"
```

---

## Task 7: Wire `AircraftOverlay` into `MapView`

**Files:**
- Modify: `src/components/MapView/MapView.tsx`

- [ ] **Step 1: Import and render `AircraftOverlay`**

In `src/components/MapView/MapView.tsx`, add the import after the existing `AircraftMarker` import:

```ts
import { AircraftOverlay } from './AircraftOverlay';
```

Find the aircraft render loop (around line 63–65):

```tsx
{aircraft.map((ac) => (
  <AircraftMarker key={ac.hex} aircraft={ac} />
))}
```

Replace it with:

```tsx
{aircraft.map((ac) => (
  <React.Fragment key={ac.hex}>
    <AircraftOverlay aircraft={ac} />
    <AircraftMarker aircraft={ac} />
  </React.Fragment>
))}
```

Also add `import React from 'react';` at the top if not already present (check first — if there's already `import { useEffect, useState } from 'react'`, change it to `import React, { useEffect, useState } from 'react'`).

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/MapView/MapView.tsx
git commit -m "feat: render AircraftOverlay alongside AircraftMarker in map view"
```

---

## Task 8: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Check map view**

- Aircraft icons appear filled (semi-transparent color, not just outlined)
- A short dashed line extends from each aircraft in its direction of travel
- Aircraft that have been visible for more than one poll cycle show a solid trail behind them

- [ ] **Step 3: Switch to radar view**

- Aircraft silhouettes remain outline-only (no fill)
- Dashed heading lines extend from each aircraft nose
- Solid brighter-colored trails trace each aircraft's recent path
- Trails disappear when aircraft drop off the feed

- [ ] **Step 4: Stop the dev server and do final commit if needed**

If any small fixes were needed during verification, commit them:

```bash
git add -p
git commit -m "fix: visual tweaks from manual verification"
```
