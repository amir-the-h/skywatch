# Radar Heading Rotation + Compass Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `headingDeg` setting that rotates the radar so the user's bearing points up, and replaces the single `N` label with 12 compass labels (N, 30, 60, E, 120, 150, S, 210, 240, W, 300, 330) at the canvas edge.

**Architecture:** `headingDeg` is persisted in `useSettingsStore` (Zustand + localStorage). `RadarView.tsx` reads it and passes it into `drawRadar`. Inside `drawRadar`, a `ctx.rotate()` wraps all geo-positioned drawing; `drawHeadingLabels` (replacing `drawCardinals`) draws labels in the rotated context but outside the pan-offset context so they stay at the canvas edge.

**Tech Stack:** React 19, TypeScript, Zustand, HTML Canvas 2D API, Vitest

---

## File Map

| File | Change |
|------|--------|
| `src/types/aircraft.ts` | Add `headingDeg: number` to `Settings` interface and `DEFAULT_SETTINGS` |
| `src/components/RadarView/RadarCanvas.ts` | Add `headingDeg` to `RadarDrawParams`; replace `drawCardinals` with exported `drawHeadingLabels`; apply rotation in `drawRadar` |
| `src/components/RadarView/RadarCanvas.test.ts` | Add tests for `drawHeadingLabels` |
| `src/components/RadarView/RadarView.tsx` | Destructure `headingDeg` from settings store, pass to `drawRadar` |
| `src/components/SettingsPanel/SettingsModal.tsx` | Add `headingDeg` number input after elevation field |

---

## Task 1: Add `headingDeg` to the Settings type

**Files:**
- Modify: `src/types/aircraft.ts`

- [ ] **Step 1: Add field to the `Settings` interface**

In `src/types/aircraft.ts`, add `headingDeg` to the `Settings` interface (after `muteEmergencyAlerts`):

```ts
export interface Settings {
  lat: number;
  lng: number;
  radiusKm: number;
  tileSource: 'osm' | 'satellite';
  view: 'map' | 'radar';
  ringIntervals: number[];
  trailLength: number;
  labelConditions: LabelCondition[];
  showAirports: boolean;
  airportTypes: ('large_airport' | 'medium_airport' | 'small_airport')[];
  observerElevationFt?: number;
  muteEmergencyAlerts: boolean;
  headingDeg: number;
}
```

- [ ] **Step 2: Add default value**

In `DEFAULT_SETTINGS` in the same file, add:

```ts
export const DEFAULT_SETTINGS: Settings = {
  lat: 41.0082,
  lng: 28.9784,
  radiusKm: 150,
  tileSource: 'osm',
  view: 'map',
  ringIntervals: [25, 50, 100, 150],
  trailLength: 50,
  labelConditions: ['always'],
  showAirports: true,
  airportTypes: ['large_airport', 'medium_airport'],
  muteEmergencyAlerts: false,
  headingDeg: 0,
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (or only pre-existing errors unrelated to this change).

- [ ] **Step 4: Commit**

```bash
git add src/types/aircraft.ts
git commit -m "feat(settings): add headingDeg field (default 0 = north-up)"
```

---

## Task 2: Update RadarCanvas — rotation + heading labels

**Files:**
- Modify: `src/components/RadarView/RadarCanvas.ts`
- Modify: `src/components/RadarView/RadarCanvas.test.ts`

### Step 2a — Write the failing test first

- [ ] **Step 1: Add the test**

First, update the existing import line near the top of `src/components/RadarView/RadarCanvas.test.ts` to add `drawHeadingLabels` and `RadarDrawParams`:

```ts
// replace the existing RadarCanvas import line with:
import { computeLabelPositions, resetLabelState, drawHeadingLabels } from './RadarCanvas';
import type { RadarDrawParams } from './RadarCanvas';
```

Then append the following `describe` block at the bottom of the file (after the last closing `}`):

```ts
function makeCtx() {
  const calls: Array<{ text: string; font: string }> = [];
  let currentFont = '';
  return {
    ctx: {
      save: () => {},
      restore: () => {},
      fillText: (text: string, _x: number, _y: number) => calls.push({ text, font: currentFont }),
      get font() { return currentFont; },
      set font(v: string) { currentFont = v; },
      set fillStyle(_: unknown) {},
      set textAlign(_: unknown) {},
      set textBaseline(_: unknown) {},
    } as unknown as CanvasRenderingContext2D,
    calls,
  };
}

const BASE_HEADING = { width: 800, height: 600 } as unknown as RadarDrawParams;

describe('drawHeadingLabels', () => {
  it('emits all 12 compass labels', () => {
    const { ctx, calls } = makeCtx();
    drawHeadingLabels({ ...BASE_HEADING, ctx });
    const texts = calls.map(c => c.text);
    expect(texts).toContain('N');
    expect(texts).toContain('E');
    expect(texts).toContain('S');
    expect(texts).toContain('W');
    expect(texts).toContain('30');
    expect(texts).toContain('60');
    expect(texts).toContain('120');
    expect(texts).toContain('150');
    expect(texts).toContain('210');
    expect(texts).toContain('240');
    expect(texts).toContain('300');
    expect(texts).toContain('330');
    expect(calls).toHaveLength(12);
  });

  it('renders N, E, S, W in bold', () => {
    const { ctx, calls } = makeCtx();
    drawHeadingLabels({ ...BASE_HEADING, ctx });
    for (const label of ['N', 'E', 'S', 'W']) {
      const call = calls.find(c => c.text === label)!;
      expect(call.font).toMatch(/bold/);
    }
  });

  it('renders numeric labels without bold', () => {
    const { ctx, calls } = makeCtx();
    drawHeadingLabels({ ...BASE_HEADING, ctx });
    for (const label of ['30', '60', '120', '150', '210', '240', '300', '330']) {
      const call = calls.find(c => c.text === label)!;
      expect(call.font).not.toMatch(/bold/);
    }
  });
});
```

- [ ] **Step 2: Run the test — expect it to fail**

```bash
npx vitest run src/components/RadarView/RadarCanvas.test.ts
```

Expected: FAIL — `drawHeadingLabels` is not exported yet.

### Step 2b — Implement the changes

- [ ] **Step 3: Add `headingDeg` to `RadarDrawParams`**

In `src/components/RadarView/RadarCanvas.ts`, update the `RadarDrawParams` interface (add after `centerWeather`):

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
  panOffset: { x: number; y: number };
  trailLength: number;
  labelConditions: LabelCondition[];
  airports: Airport[];
  zoomLevel: number;
  metar?: Map<string, MetarData>;
  centerWeather?: PointWeather | null;
  headingDeg: number;
}
```

- [ ] **Step 4: Replace `drawCardinals` with `drawHeadingLabels`**

Remove the existing `drawCardinals` function and replace it with this exported function (place it in the same spot, after `drawGrid`):

```ts
const COMPASS_LABELS: Array<{ deg: number; text: string; bold: boolean }> = [
  { deg: 0,   text: 'N',   bold: true },
  { deg: 30,  text: '30',  bold: false },
  { deg: 60,  text: '60',  bold: false },
  { deg: 90,  text: 'E',   bold: true },
  { deg: 120, text: '120', bold: false },
  { deg: 150, text: '150', bold: false },
  { deg: 180, text: 'S',   bold: true },
  { deg: 210, text: '210', bold: false },
  { deg: 240, text: '240', bold: false },
  { deg: 270, text: 'W',   bold: true },
  { deg: 300, text: '300', bold: false },
  { deg: 330, text: '330', bold: false },
];

export function drawHeadingLabels({ ctx, width, height }: RadarDrawParams) {
  const cx = width / 2;
  const cy = height / 2;
  const edgeR = Math.min(width, height) / 2 - 8;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const { deg, text, bold } of COMPASS_LABELS) {
    const rad = (deg * Math.PI) / 180;
    const x = cx + Math.sin(rad) * edgeR;
    const y = cy - Math.cos(rad) * edgeR;
    ctx.font = bold ? 'bold 13px monospace' : '11px monospace';
    ctx.fillStyle = bold ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)';
    ctx.fillText(text, x, y);
  }

  ctx.restore();
}
```

- [ ] **Step 5: Rewrite `drawRadar` to apply rotation**

Replace the existing `drawRadar` function body with this:

```ts
export function drawRadar(params: RadarDrawParams) {
  const { ctx, width, height, panOffset, headingDeg } = params;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  // Outer save: rotation only (heading labels live here, not in pan context)
  ctx.save();
  if (headingDeg !== 0) {
    const cx = width / 2;
    const cy = height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((-headingDeg * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  // Inner save: pan offset for all geo-positioned content
  ctx.save();
  ctx.translate(panOffset.x, panOffset.y);
  drawRings(params);
  drawGrid(params);
  drawAirports(params);
  if (params.centerWeather) {
    drawWindBarb(ctx, width / 2, height / 2, params.centerWeather, Math.sqrt(params.zoomLevel));
  }
  const renderData = drawAllAircraft(params);
  drawAircraftLabels(params, renderData);
  ctx.restore();

  // Heading labels: in rotation context but NOT shifted by panOffset
  drawHeadingLabels(params);
  ctx.restore();
}
```

- [ ] **Step 6: Run the tests — expect them to pass**

```bash
npx vitest run src/components/RadarView/RadarCanvas.test.ts
```

Expected: all tests PASS (including the new `drawHeadingLabels` suite).

- [ ] **Step 7: Commit**

```bash
git add src/components/RadarView/RadarCanvas.ts src/components/RadarView/RadarCanvas.test.ts
git commit -m "feat(radar): replace drawCardinals with drawHeadingLabels, apply heading rotation"
```

---

## Task 3: Wire `headingDeg` through RadarView

**Files:**
- Modify: `src/components/RadarView/RadarView.tsx`

- [ ] **Step 1: Read `headingDeg` from the settings store**

In `RadarView.tsx`, update the destructuring on line 25 to include `headingDeg`:

```ts
const { lat, lng, radiusKm, ringIntervals, trailLength, labelConditions, headingDeg } = useSettingsStore();
```

- [ ] **Step 2: Mirror into a ref (following the existing pattern)**

After the existing `labelConditionsRef` definition (around line 54), add:

```ts
const headingDegRef = useRef(headingDeg);
```

After the existing `useEffect` that syncs `trailLengthRef` (around line 60), add:

```ts
useEffect(() => { headingDegRef.current = headingDeg; }, [headingDeg]);
```

- [ ] **Step 3: Pass `headingDeg` into `drawRadar`**

In the `drawRadar({...})` call inside the `loop` function (around line 114), add `headingDeg`:

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
  panOffset: panOffsetRef.current,
  trailLength: trailLengthRef.current,
  labelConditions: labelConditionsRef.current,
  airports: airportsRef.current,
  zoomLevel: zoomLevelRef.current,
  metar: metarRef.current,
  centerWeather: centerWeatherRef.current,
  headingDeg: headingDegRef.current,
});
```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/RadarView/RadarView.tsx
git commit -m "feat(radar): pass headingDeg from settings into drawRadar"
```

---

## Task 4: Add heading input to SettingsModal

**Files:**
- Modify: `src/components/SettingsPanel/SettingsModal.tsx`

- [ ] **Step 1: Add the input after the elevation field**

In `SettingsModal.tsx`, after the elevation `<label>` block (around line 104), add:

```tsx
<label>
  Radar heading (°)
  <input
    type="number"
    min={0}
    max={359}
    step={1}
    value={settings.headingDeg}
    onChange={(e) => {
      const v = parseInt(e.target.value);
      if (!isNaN(v)) settings.update({ headingDeg: Math.min(359, Math.max(0, v)) });
    }}
  />
</label>
<div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: -8 }}>
  0 = north-up · rotates radar so your heading faces top
</div>
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsPanel/SettingsModal.tsx
git commit -m "feat(settings): add radar heading input"
```

---

## Verification

- [ ] Start the dev stack and open the radar view:

  ```bash
  # terminal 1
  docker run -d -p 6379:6379 redis:7-alpine
  cd backend && REDIS_URL=redis://localhost:6379 npx tsx src/server.ts

  # terminal 2
  VITE_BACKEND_URL=http://localhost:3001 npm run dev
  ```

- [ ] Open settings, set **Radar heading** to `90`. Confirm the radar rotates so East faces up and the `E` label appears at the top.
- [ ] Set heading to `0`. Confirm `N` is back at the top.
- [ ] Confirm all 12 labels (N, 30, 60, E, 120, 150, S, 210, 240, W, 300, 330) are visible around the edge.
- [ ] Pan and zoom — confirm heading labels stay pinned at the canvas edge while aircraft and rings move normally.
- [ ] Reload the page — confirm `headingDeg` is persisted from localStorage.
