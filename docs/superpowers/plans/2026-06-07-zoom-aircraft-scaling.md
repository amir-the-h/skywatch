# Zoom-Aware Aircraft Scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scale aircraft icons, canvas callsign labels, and the hover tooltip with zoom level (√zoom curve) so zooming in feels like a genuine zoom; also fix the bounds-culling bug that causes aircraft to disappear when panned.

**Architecture:** Add `zoomLevel` to `RadarDrawParams` so canvas draw functions can compute `iconScale = Math.sqrt(zoomLevel)` and apply it to icon size, heading line, label geometry, and font sizes. Fix the bounds check to account for `panOffset`. Expose zoom scale as React state in `RadarView` and forward it as a `scale` prop to `FlightPreview`.

**Tech Stack:** TypeScript, React, Canvas 2D API, Vitest

---

## File Map

| File | Change |
|---|---|
| `src/components/RadarView/RadarCanvas.ts` | Add `zoomLevel` to params; fix bounds check; scale icon + labels |
| `src/components/RadarView/RadarView.tsx` | Pass `zoomLevel` to `drawRadar`; add `zoomScale` state; pass to `FlightPreview` |
| `src/components/FlightBubble/FlightPreview.tsx` | Add `scale` prop; apply CSS transform |
| `src/components/RadarView/zoomScale.test.ts` | Unit tests for `iconScale` helper and bounds culling logic |

---

### Task 1: Add `iconScale` helper and tests

**Files:**
- Create: `src/components/RadarView/zoomScale.test.ts`

This task extracts the scale formula into a testable unit so later tasks can import it with confidence.

- [ ] **Step 1: Write failing tests**

Create `src/components/RadarView/zoomScale.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { iconScaleForZoom, screenPosToCull } from './zoomScale';

describe('iconScaleForZoom', () => {
  it('returns 1 at zoom level 1', () => {
    expect(iconScaleForZoom(1)).toBe(1);
  });

  it('returns 2 at zoom level 4', () => {
    expect(iconScaleForZoom(4)).toBeCloseTo(2, 5);
  });

  it('returns 3 at zoom level 9', () => {
    expect(iconScaleForZoom(9)).toBeCloseTo(3, 5);
  });
});

describe('screenPosToCull', () => {
  it('returns true when aircraft is off-screen to the left (no pan)', () => {
    expect(screenPosToCull(-30, 200, 0, 0, 800, 600, 20)).toBe(true);
  });

  it('returns false when aircraft is visible with no pan', () => {
    expect(screenPosToCull(400, 300, 0, 0, 800, 600, 20)).toBe(false);
  });

  it('returns false when aircraft is off raw canvas but panned into view', () => {
    // pos.x = -200, panOffset.x = 300 → screenX = 100 (visible)
    expect(screenPosToCull(-200, 300, 300, 0, 800, 600, 20)).toBe(false);
  });

  it('returns true when aircraft is on raw canvas but panned out of view', () => {
    // pos.x = 700, panOffset.x = -500 → screenX = 200... wait
    // pos.x = 100, panOffset.x = -500 → screenX = -400 (off-screen)
    expect(screenPosToCull(100, 300, -500, 0, 800, 600, 20)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- src/components/RadarView/zoomScale.test.ts
```

Expected: FAIL — `Cannot find module './zoomScale'`

- [ ] **Step 3: Create `src/components/RadarView/zoomScale.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- src/components/RadarView/zoomScale.test.ts
```

Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/RadarView/zoomScale.ts src/components/RadarView/zoomScale.test.ts
git commit -m "feat: add iconScaleForZoom and screenPosToCull helpers"
```

---

### Task 2: Add `zoomLevel` to `RadarDrawParams` and pass from `RadarView`

**Files:**
- Modify: `src/components/RadarView/RadarCanvas.ts` (interface only)
- Modify: `src/components/RadarView/RadarView.tsx` (draw loop only)

- [ ] **Step 1: Add `zoomLevel` to `RadarDrawParams` interface**

In `src/components/RadarView/RadarCanvas.ts`, find the `RadarDrawParams` interface (line 15) and add one field:

```ts
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
  airports: Airport[];
  zoomLevel: number;
}
```

- [ ] **Step 2: Pass `zoomLevel` from the draw loop in `RadarView.tsx`**

In `src/components/RadarView/RadarView.tsx`, find the `drawRadar({...})` call inside the `loop` function (around line 87). Add `zoomLevel: zoomLevelRef.current` to the object:

```ts
drawRadar({
  ctx,
  width: canvas.width,
  height: canvas.height,
  centerLat: latRef.current,
  centerLon: lngRef.current,
  radiusKm: effectiveRadius,
  ringIntervals,
  aircraft,
  hoveredHex: hoveredHexRef.current,
  pinnedHexes: pinnedHexesRef.current,
  theme,
  pathHistory,
  panOffset: panOffsetRef.current,
  trailLength: trailLengthRef.current,
  labelConditions: labelConditionsRef.current,
  airports: airportsRef.current,
  zoomLevel: zoomLevelRef.current,
});
```

- [ ] **Step 3: Run existing tests to confirm nothing broke**

```bash
npm test
```

Expected: all tests pass (TypeScript will enforce the new required field)

- [ ] **Step 4: Commit**

```bash
git add src/components/RadarView/RadarCanvas.ts src/components/RadarView/RadarView.tsx
git commit -m "feat: thread zoomLevel through RadarDrawParams"
```

---

### Task 3: Fix bounds-culling bug and scale aircraft icon

**Files:**
- Modify: `src/components/RadarView/RadarCanvas.ts` (`drawAllAircraft` function)

- [ ] **Step 1: Import helpers at top of `RadarCanvas.ts`**

Add to the import block at the top of `src/components/RadarView/RadarCanvas.ts`:

```ts
import { iconScaleForZoom, screenPosToCull } from './zoomScale';
```

- [ ] **Step 2: Replace `drawAllAircraft` body**

Find `drawAllAircraft` (line 188). Replace the entire function body with:

```ts
function drawAllAircraft(params: RadarDrawParams): Map<string, AircraftRenderData> {
  const { ctx, width, height, centerLat, centerLon, radiusKm, aircraft, hoveredHex, pinnedHexes, theme, pathHistory, trailLength, panOffset, zoomLevel } = params;

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
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/RadarView/RadarCanvas.ts
git commit -m "fix: correct bounds culling for pan offset; scale aircraft icon with sqrt(zoom)"
```

---

### Task 4: Scale canvas callsign labels

**Files:**
- Modify: `src/components/RadarView/RadarCanvas.ts` (`drawAircraftLabels` function)

- [ ] **Step 1: Replace `drawAircraftLabels` body**

Find `drawAircraftLabels` (line 278). Replace the entire function body:

```ts
function drawAircraftLabels(params: RadarDrawParams, renderData: Map<string, AircraftRenderData>) {
  const { ctx, width, height, aircraft, theme, labelConditions, pinnedHexes, zoomLevel } = params;
  const textColor = theme === 'dark' ? '#e5e7eb' : '#1f2937';
  const s = iconScaleForZoom(zoomLevel);

  const labelW = LABEL_W * s;
  const labelH = LABEL_H * s;
  const labelOffset = LABEL_OFFSET * s;
  const pad = 7 * s;
  const r = 5 * s;

  for (const ac of aircraft) {
    const rd = renderData.get(ac.hex);
    if (!rd) continue;
    if (!shouldShowLabel(ac, pinnedHexes, labelConditions)) continue;
    const { pos, color } = rd;
    const callsign = ac.flight || ac.hex;
    const phase = inferFlightPhase(ac);
    const phaseColor = getPhaseColor(phase);

    let dx = labelOffset;
    let dy = -labelOffset;
    if (pos.x > width - labelW - 20) dx = -(labelW + labelOffset);
    if (pos.y < labelH + 20) dy = labelOffset;

    const lx = pos.x + dx;
    const ly = pos.y + dy;

    const connX = dx > 0 ? lx : lx + labelW;
    const connY = dy > 0 ? ly : ly + labelH;

    // Connector line
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
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/components/RadarView/RadarCanvas.ts
git commit -m "feat: scale canvas callsign labels with sqrt(zoom)"
```

---

### Task 5: Scale hit-test radius in RadarView

**Files:**
- Modify: `src/components/RadarView/RadarView.tsx` (`hitTest` function)

The hit-test radius should grow with the icon so clicking aircraft at high zoom still works.

- [ ] **Step 1: Update `hitTest` in `RadarView.tsx`**

Find the `hitTest` callback (around line 160). Change the hit radius from the hardcoded `18` to `18 * Math.sqrt(zoomLevelRef.current)`:

```ts
const hitTest = useCallback(
  (clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left - panOffsetRef.current.x;
    const my = clientY - rect.top - panOffsetRef.current.y;
    const effectiveRadius = radiusKmRef.current / zoomLevelRef.current;
    const hitRadius = 18 * Math.sqrt(zoomLevelRef.current);

    for (const ac of aircraftMap.values()) {
      if (!matchesFilter(ac, filtersRef.current)) continue;
      const pos = latLonToCanvas(
        ac._renderLat, ac._renderLon,
        latRef.current, lngRef.current, effectiveRadius,
        canvas.width, canvas.height
      );
      if (Math.hypot(mx - pos.x, my - pos.y) < hitRadius) return ac.hex;
    }
    return null;
  },
  [aircraftMap]
);
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/components/RadarView/RadarView.tsx
git commit -m "feat: scale aircraft hit-test radius with zoom"
```

---

### Task 6: Scale FlightPreview hover tooltip

**Files:**
- Modify: `src/components/FlightBubble/FlightPreview.tsx`
- Modify: `src/components/RadarView/RadarView.tsx`

- [ ] **Step 1: Add `scale` prop to `FlightPreview.tsx`**

Replace the entire file content:

```tsx
import type { Aircraft } from '../../types/aircraft';

interface Props {
  aircraft: Aircraft;
  x: number;
  y: number;
  scale?: number;
}

export function FlightPreview({ aircraft, x, y, scale = 1 }: Props) {
  return (
    <div
      className="flight-preview"
      style={{
        left: x + 12,
        top: y - 8,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}
    >
      <div className="fp-callsign">{aircraft.flight || aircraft.hex}</div>
      <div className="fp-type">{aircraft.desc ?? aircraft.t}</div>
      <div className="fp-data">
        {aircraft.alt_baro.toLocaleString()} ft · {Math.round(aircraft.gs)} kts
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `zoomScale` state to `RadarView.tsx` and pass to `FlightPreview`**

In `src/components/RadarView/RadarView.tsx`:

a) Add `zoomScale` state near the top of the component, after the other `useState` calls:

```ts
const [zoomScale, setZoomScale] = useState(1);
```

b) In the `handleWheel` function (around line 128), after `zoomLevelRef.current = applyZoom(oldZoom, normalizedDeltaY);`, add:

```ts
setZoomScale(Math.sqrt(zoomLevelRef.current));
```

c) In the JSX, find `<FlightPreview ... />` (around line 270) and add the `scale` prop:

```tsx
{hoveredAircraft && hoverPos && !pinnedHexes.has(hoveredAircraft.hex) && (
  <FlightPreview aircraft={hoveredAircraft} x={hoverPos.x} y={hoverPos.y} scale={zoomScale} />
)}
```

d) Also update the `onDoubleClick` handler to reset `zoomScale` when zoom resets:

```tsx
onDoubleClick={() => {
  if (pinTimeoutRef.current) {
    clearTimeout(pinTimeoutRef.current);
    pinTimeoutRef.current = null;
  }
  zoomLevelRef.current = 1;
  panOffsetRef.current = { x: 0, y: 0 };
  setZoomScale(1);
}}
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/FlightBubble/FlightPreview.tsx src/components/RadarView/RadarView.tsx
git commit -m "feat: scale FlightPreview hover tooltip with sqrt(zoom)"
```

---

### Task 7: Manual verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify zoom scaling**

Open the app. Scroll to zoom in. Confirm:
- Aircraft icons grow proportionally with zoom (not 1:1 — noticeably larger but not overwhelming at 4×)
- Canvas callsign labels grow with the icons (text, badge, box all scale together)
- Hover tooltip (`FlightPreview`) grows when zoomed in
- `FlightBubble` pinned panels are unchanged

- [ ] **Step 3: Verify disappear bug is fixed**

Zoom in on an aircraft that is NOT at canvas center (use cursor-based zoom on an off-center aircraft). Confirm the aircraft stays visible and doesn't disappear as you zoom.

- [ ] **Step 4: Verify double-click reset**

Double-click to reset zoom. Confirm icons return to baseline size and `FlightPreview` tooltip returns to normal size.
