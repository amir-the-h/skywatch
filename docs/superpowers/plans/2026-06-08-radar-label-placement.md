# Radar Label Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static 4-position label fallback in `RadarCanvas.ts` with a hybrid slot-selection + force-nudge + lerp animation system that prevents aircraft label bubbles from overlapping.

**Architecture:** A new `computeLabelPositions()` function runs each frame before drawing. It sorts visible labels by priority, scores 16 candidate slots per label (8 angles × 2 radii), applies a single force-nudge pass to spread residual overlaps, then lerp-animates from the previous frame's positions stored in a module-level map. `drawAircraftLabels()` consumes the result map instead of computing positions inline.

**Tech Stack:** TypeScript, Canvas 2D API, Vitest (jsdom environment)

---

### Task 1: Update constants, add module-level lerp state, add `rectIntersectionArea` helper

**Files:**
- Modify: `src/components/RadarView/RadarCanvas.ts`

- [ ] **Step 1: Replace the three label constants and the `AircraftRenderData` interface**

In `RadarCanvas.ts`, replace lines 11–14 and lines 270–272:

```typescript
// Remove the non-exported interface at lines 11-14:
// interface AircraftRenderData { ... }

// Replace lines 270-272:
// const LABEL_W = 100;
// const LABEL_H = 52;
// const LABEL_OFFSET = 40;
```

with the following block (insert after imports, before `export interface RadarDrawParams`):

```typescript
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
```

And replace the three constants at the bottom of the file (currently before `drawAircraftLabels`) with:

```typescript
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
  (-3 * Math.PI) / 4,  // 225° upper-left
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
```

- [ ] **Step 2: Add `rectIntersectionArea` helper immediately before `drawAircraftLabels`**

```typescript
function rectIntersectionArea(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): number {
  const ix = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
  const iy = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
  return ix * iy;
}
```

- [ ] **Step 3: Run tests to verify no existing tests are broken**

```bash
cd /mnt/storage/shared/projects/personal/flight-tracker && npm test
```
Expected: all existing tests PASS (no regressions from the constant rename)

- [ ] **Step 4: Commit**

```bash
git add src/components/RadarView/RadarCanvas.ts
git commit -m "refactor(radar): add label placement constants, exported types, and lerp state"
```

---

### Task 2: Write failing tests for `computeLabelPositions`

**Files:**
- Create: `src/components/RadarView/RadarCanvas.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// src/components/RadarView/RadarCanvas.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { computeLabelPositions, resetLabelState } from './RadarCanvas';
import type { Aircraft, LabelCondition } from '../../types/aircraft';

function ac(hex: string, overrides: Partial<Aircraft> = {}): Aircraft {
  return {
    hex, flight: hex.toUpperCase(), r: 'N1', t: 'B738',
    lat: 41, lon: 28, alt_baro: 35000, gs: 480, track: 0,
    baro_rate: 0, seen: 1, phase: 'CRZ', pathHistory: [],
    _renderLat: 41, _renderLon: 28, _lastSeen: 0,
    ...overrides,
  };
}

function makeRenderData(...entries: Array<[string, number, number]>) {
  return new Map(entries.map(([hex, x, y]) => [hex, { pos: { x, y }, color: '#ffffff' }]));
}

function overlapArea(ax: number, ay: number, bx: number, by: number, w: number, h: number): number {
  const ix = Math.max(0, Math.min(ax + w, bx + w) - Math.max(ax, bx));
  const iy = Math.max(0, Math.min(ay + h, by + h) - Math.max(ay, by));
  return ix * iy;
}

const BASE: {
  width: number; height: number; pinnedHexes: Set<string>;
  labelConditions: LabelCondition[]; panOffset: { x: number; y: number }; zoomLevel: number;
} = {
  width: 800, height: 600,
  pinnedHexes: new Set(),
  labelConditions: ['always'],
  panOffset: { x: 0, y: 0 },
  zoomLevel: 1,
};

describe('computeLabelPositions', () => {
  beforeEach(() => resetLabelState());

  describe('single aircraft', () => {
    it('returns a placement for the visible aircraft', () => {
      const result = computeLabelPositions(
        { ...BASE, aircraft: [ac('abc')] },
        makeRenderData(['abc', 400, 300]),
        1,
      );
      expect(result.has('abc')).toBe(true);
    });

    it('places the label to the upper-right on first frame', () => {
      const result = computeLabelPositions(
        { ...BASE, aircraft: [ac('abc')] },
        makeRenderData(['abc', 400, 300]),
        1,
      );
      const p = result.get('abc')!;
      // upper-right: label center-x > aircraft x, label center-y < aircraft y
      expect(p.lx + 50).toBeGreaterThan(400);
      expect(p.ly + 26).toBeLessThan(300);
    });

    it('returns full opacity when no overlap', () => {
      const result = computeLabelPositions(
        { ...BASE, aircraft: [ac('abc')] },
        makeRenderData(['abc', 400, 300]),
        1,
      );
      expect(result.get('abc')!.opacity).toBeCloseTo(1, 1);
    });
  });

  describe('two aircraft at the same position', () => {
    it('places them in different slots so overlap is below 50%', () => {
      const result = computeLabelPositions(
        { ...BASE, aircraft: [ac('aaa'), ac('bbb')] },
        makeRenderData(['aaa', 400, 300], ['bbb', 400, 300]),
        1,
      );
      const a = result.get('aaa')!;
      const b = result.get('bbb')!;
      const overlap = overlapArea(a.lx, a.ly, b.lx, b.ly, 100, 52);
      expect(overlap).toBeLessThan(100 * 52 * 0.5);
    });
  });

  describe('priority: pinned before normal', () => {
    it('gives the pinned aircraft the preferred upper-right slot', () => {
      const result = computeLabelPositions(
        { ...BASE, aircraft: [ac('normal'), ac('pinned')], pinnedHexes: new Set(['pinned']) },
        makeRenderData(['normal', 400, 300], ['pinned', 400, 300]),
        1,
      );
      const pinned = result.get('pinned')!;
      // Pinned gets upper-right: label center right of aircraft, above aircraft
      expect(pinned.lx + 50).toBeGreaterThan(400);
      expect(pinned.ly + 26).toBeLessThan(300);
    });
  });

  describe('canvas edge avoidance', () => {
    it('does not place label outside canvas bounds when aircraft is near top-left corner', () => {
      const result = computeLabelPositions(
        { ...BASE, aircraft: [ac('edge')] },
        makeRenderData(['edge', 5, 5]),
        1,
      );
      const p = result.get('edge')!;
      expect(p.lx).toBeGreaterThanOrEqual(0);
      expect(p.ly).toBeGreaterThanOrEqual(0);
    });
  });

  describe('opacity fallback for extreme clusters', () => {
    it('gives at least one label opacity < 1 when 5 aircraft share the same spot', () => {
      const aircraft = ['a', 'b', 'c', 'd', 'e'].map(h => ac(h));
      const renderData = makeRenderData(
        ['a', 400, 300], ['b', 400, 300], ['c', 400, 300],
        ['d', 400, 300], ['e', 400, 300],
      );
      const result = computeLabelPositions({ ...BASE, aircraft }, renderData, 1);
      const opacities = [...result.values()].map(p => p.opacity);
      expect(opacities.some(o => o < 1)).toBe(true);
    });
  });

  describe('omits aircraft with no render data', () => {
    it('does not include aircraft missing from renderData', () => {
      const result = computeLabelPositions(
        { ...BASE, aircraft: [ac('missing')] },
        new Map(),
        1,
      );
      expect(result.has('missing')).toBe(false);
    });
  });

  describe('lerp: new aircraft initialise at target', () => {
    it('returns same position on frame 1 and frame 2 for a stationary aircraft', () => {
      const aircraft = [ac('stable')];
      const renderData = makeRenderData(['stable', 400, 300]);
      const r1 = computeLabelPositions({ ...BASE, aircraft }, renderData, 1);
      const r2 = computeLabelPositions({ ...BASE, aircraft }, renderData, 1);
      expect(r1.get('stable')!.lx).toBeCloseTo(r2.get('stable')!.lx, 0);
      expect(r1.get('stable')!.ly).toBeCloseTo(r2.get('stable')!.ly, 0);
    });
  });

  describe('lerp: stale entries are removed', () => {
    it('does not include a gone aircraft in the next frame result', () => {
      computeLabelPositions(
        { ...BASE, aircraft: [ac('gone')] },
        makeRenderData(['gone', 400, 300]),
        1,
      );
      const r2 = computeLabelPositions({ ...BASE, aircraft: [] }, new Map(), 1);
      expect(r2.has('gone')).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail as expected**

```bash
cd /mnt/storage/shared/projects/personal/flight-tracker && npm test -- RadarCanvas
```
Expected: FAIL — `computeLabelPositions` is not exported from `./RadarCanvas`

---

### Task 3: Implement `computeLabelPositions`

**Files:**
- Modify: `src/components/RadarView/RadarCanvas.ts`

- [ ] **Step 1: Add `computeLabelPositions` export immediately before `drawAircraftLabels`**

```typescript
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

    committed.push({ lx: bestLx, ly: bestLy, hex: ac.hex });
  }

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

    // Opacity: fade proportionally to remaining overlap after the nudge pass
    const labelArea = labelW * labelH;
    let totalOverlap = 0;
    for (const other of committed) {
      if (other.hex === c.hex) continue;
      const otherCur = labelPosMap.get(other.hex);
      if (!otherCur) continue;
      totalOverlap += rectIntersectionArea(lx, ly, labelW, labelH, otherCur.x, otherCur.y, labelW, labelH);
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
```

- [ ] **Step 2: Run the RadarCanvas tests to verify they pass**

```bash
cd /mnt/storage/shared/projects/personal/flight-tracker && npm test -- RadarCanvas
```
Expected: all tests in `RadarCanvas.test.ts` PASS

- [ ] **Step 3: Run the full test suite to confirm no regressions**

```bash
cd /mnt/storage/shared/projects/personal/flight-tracker && npm test
```
Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/RadarView/RadarCanvas.ts src/components/RadarView/RadarCanvas.test.ts
git commit -m "feat(radar): implement computeLabelPositions — slot selection, force nudge, lerp"
```

---

### Task 4: Wire `computeLabelPositions` into `drawAircraftLabels`

**Files:**
- Modify: `src/components/RadarView/RadarCanvas.ts`

- [ ] **Step 1: Replace the entire `drawAircraftLabels` function**

Replace the current `drawAircraftLabels` function (from `function drawAircraftLabels(` through its closing `}`) with the following. Key changes: positions come from `computeLabelPositions`, `globalAlpha` tracks `opacity`, connector line uses `connX`/`connY` from the placement, `panOffset` is now destructured from params:

```typescript
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
```

- [ ] **Step 2: Run the full test suite**

```bash
cd /mnt/storage/shared/projects/personal/flight-tracker && npm test
```
Expected: all tests PASS

- [ ] **Step 3: Build to verify TypeScript compiles cleanly**

```bash
cd /mnt/storage/shared/projects/personal/flight-tracker && npm run build 2>&1 | tail -20
```
Expected: exits 0, no TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/components/RadarView/RadarCanvas.ts
git commit -m "feat(radar): wire label collision avoidance into draw loop"
```
