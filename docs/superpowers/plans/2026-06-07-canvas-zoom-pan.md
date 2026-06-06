# Canvas Zoom & Pan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ephemeral mouse-wheel zoom and click-drag pan to the RadarView canvas, resetting on page reload or settings change.

**Architecture:** Extract the coordinate math for pan and zoom into a pure `viewTransform.ts` module (testable without a DOM). `RadarView` stores pan/zoom in refs (no React state — the rAF loop already redraws every frame), reads effective center/radius from those refs when drawing and hit-testing, and resets refs when settings change.

**Tech Stack:** React 19, TypeScript, Vitest, Canvas 2D API

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/components/RadarView/viewTransform.ts` | **Create** | Pure `applyPan` and `applyZoom` functions |
| `src/components/RadarView/viewTransform.test.ts` | **Create** | Unit tests for both functions |
| `src/components/RadarView/RadarView.tsx` | **Modify** | Refs, event handlers, effective params |

---

### Task 1: Create `viewTransform.ts` with `applyPan` — TDD

**Files:**
- Create: `src/components/RadarView/viewTransform.ts`
- Create: `src/components/RadarView/viewTransform.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/RadarView/viewTransform.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyPan } from './viewTransform';

describe('applyPan', () => {
  const base = { dLat: 0, dLon: 0 };
  // canvas 800×800, radius 100km → scale = 400/100 = 4px/km
  const W = 800, H = 800, radius = 100, lat = 0;

  it('dragging right (positive dx) decreases dLon', () => {
    const result = applyPan(base, 40, 0, lat, radius, W, H);
    expect(result.dLon).toBeLessThan(0);
  });

  it('dragging down (positive dy) increases dLat', () => {
    const result = applyPan(base, 0, 40, lat, radius, W, H);
    expect(result.dLat).toBeGreaterThan(0);
  });

  it('dragging right 40px at equator shifts lon by ~10km / 111 deg', () => {
    // kmPerPx = 100 / 400 = 0.25 km/px; dx=40 → 10 km → 10/111 ≈ 0.0901 deg
    const result = applyPan(base, 40, 0, 0, radius, W, H);
    expect(result.dLon).toBeCloseTo(-10 / 111, 3);
  });

  it('dragging down 44px shifts lat by ~11km / 111 deg', () => {
    // kmPerPx = 0.25 km/px; dy=44 → 11 km → 11/111 ≈ 0.099 deg
    const result = applyPan(base, 0, 44, 0, radius, W, H);
    expect(result.dLat).toBeCloseTo(11 / 111, 3);
  });

  it('accumulates correctly from non-zero starting offset', () => {
    const offset = { dLat: 1, dLon: -2 };
    const result = applyPan(offset, 0, 0, 0, radius, W, H);
    expect(result.dLat).toBeCloseTo(1, 5);
    expect(result.dLon).toBeCloseTo(-2, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- viewTransform
```

Expected: FAIL with "Cannot find module './viewTransform'"

- [ ] **Step 3: Implement `applyPan` in `viewTransform.ts`**

Create `src/components/RadarView/viewTransform.ts`:

```ts
export interface PanOffset {
  dLat: number;
  dLon: number;
}

/**
 * Converts a pixel drag delta into a new PanOffset.
 * Positive dx = dragging right = center moves west (dLon decreases).
 * Positive dy = dragging down  = center moves north (dLat increases).
 */
export function applyPan(
  panOffset: PanOffset,
  dx: number,
  dy: number,
  effectiveLat: number,
  effectiveRadius: number,
  canvasWidth: number,
  canvasHeight: number
): PanOffset {
  const kmPerPx = effectiveRadius / (Math.min(canvasWidth, canvasHeight) / 2);
  return {
    dLat: panOffset.dLat + (dy * kmPerPx) / 111.0,
    dLon: panOffset.dLon - (dx * kmPerPx) / (111.0 * Math.cos((effectiveLat * Math.PI) / 180)),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- viewTransform
```

Expected: all `applyPan` tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/RadarView/viewTransform.ts src/components/RadarView/viewTransform.test.ts
git commit -m "feat: add applyPan pure function with tests"
```

---

### Task 2: Add `applyZoom` to `viewTransform.ts` — TDD

**Files:**
- Modify: `src/components/RadarView/viewTransform.ts`
- Modify: `src/components/RadarView/viewTransform.test.ts`

- [ ] **Step 1: Add failing tests for `applyZoom`**

First update the import at the top of `src/components/RadarView/viewTransform.test.ts` to include `applyZoom`:

```ts
import { applyPan, applyZoom } from './viewTransform';
```

Then append the following `describe` block to the end of the file:

```ts

describe('applyZoom', () => {
  const W = 800, H = 800;
  const centerLat = 0, centerLon = 0, radiusKm = 100;

  it('zooming in (negative deltaY) increases zoomLevel', () => {
    const result = applyZoom(1, { dLat: 0, dLon: 0 }, 0, 0, W, H, centerLat, centerLon, radiusKm, -100);
    expect(result.zoomLevel).toBeGreaterThan(1);
  });

  it('zooming out (positive deltaY) decreases zoomLevel', () => {
    const result = applyZoom(1, { dLat: 0, dLon: 0 }, 0, 0, W, H, centerLat, centerLon, radiusKm, 100);
    expect(result.zoomLevel).toBeLessThan(1);
  });

  it('zooming at canvas center (mx=0, my=0) does not change panOffset', () => {
    const result = applyZoom(1, { dLat: 0, dLon: 0 }, 0, 0, W, H, centerLat, centerLon, radiusKm, -200);
    expect(result.panOffset.dLat).toBeCloseTo(0, 5);
    expect(result.panOffset.dLon).toBeCloseTo(0, 5);
  });

  it('clamps zoomLevel to minimum 0.25', () => {
    const result = applyZoom(0.26, { dLat: 0, dLon: 0 }, 0, 0, W, H, centerLat, centerLon, radiusKm, 100000);
    expect(result.zoomLevel).toBeGreaterThanOrEqual(0.25);
  });

  it('clamps zoomLevel to maximum 20', () => {
    const result = applyZoom(19.9, { dLat: 0, dLon: 0 }, 0, 0, W, H, centerLat, centerLon, radiusKm, -100000);
    expect(result.zoomLevel).toBeLessThanOrEqual(20);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- viewTransform
```

Expected: FAIL with "applyZoom is not a function"

- [ ] **Step 3: Implement `applyZoom`**

Append to `src/components/RadarView/viewTransform.ts`:

```ts
/**
 * Applies a wheel zoom toward the point under the cursor (mx, my relative to canvas center).
 * Adjusts panOffset so the geo point under the cursor stays fixed after zoom.
 */
export function applyZoom(
  zoomLevel: number,
  panOffset: PanOffset,
  mx: number,
  my: number,
  canvasWidth: number,
  canvasHeight: number,
  centerLat: number,
  centerLon: number,
  radiusKm: number,
  deltaY: number
): { zoomLevel: number; panOffset: PanOffset } {
  const effectiveRadius = radiusKm / zoomLevel;
  const effectiveLat = centerLat + panOffset.dLat;
  const effectiveLon = centerLon + panOffset.dLon;
  const scale = Math.min(canvasWidth, canvasHeight) / 2 / effectiveRadius;

  // Geo point currently under cursor
  const pointLat = effectiveLat - my / scale / 111.0;
  const pointLon = effectiveLon + mx / scale / (111.0 * Math.cos((effectiveLat * Math.PI) / 180));

  const factor = Math.pow(0.999, deltaY);
  const newZoom = Math.min(20, Math.max(0.25, zoomLevel * factor));
  const newEffectiveRadius = radiusKm / newZoom;
  const newScale = Math.min(canvasWidth, canvasHeight) / 2 / newEffectiveRadius;

  return {
    zoomLevel: newZoom,
    panOffset: {
      dLat: pointLat - centerLat + my / newScale / 111.0,
      dLon: pointLon - centerLon - mx / newScale / (111.0 * Math.cos((pointLat * Math.PI) / 180)),
    },
  };
}
```

- [ ] **Step 4: Run all tests to verify they pass**

```bash
npm test -- viewTransform
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/RadarView/viewTransform.ts src/components/RadarView/viewTransform.test.ts
git commit -m "feat: add applyZoom pure function with tests"
```

---

### Task 3: Wire effective params into `RadarView` draw loop and `hitTest`

**Files:**
- Modify: `src/components/RadarView/RadarView.tsx`

- [ ] **Step 1: Add refs and settings-mirror refs at the top of `RadarView`**

First update the import block at the top of `src/components/RadarView/RadarView.tsx`. The current first import line is:
```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
```
Add a new import after the existing imports:
```tsx
import { applyPan, applyZoom, type PanOffset } from './viewTransform';
```

Then add these refs inside `RadarView()`, after the existing `useEffect(() => { pinnedHexesRef.current = pinnedHexes; }, [pinnedHexes]);` line:

```tsx
const panOffsetRef = useRef<PanOffset>({ dLat: 0, dLon: 0 });
const zoomLevelRef = useRef(1);

// Mirror settings into refs so stable wheel/drag callbacks read fresh values
const latRef = useRef(lat);
const lngRef = useRef(lng);
const radiusKmRef = useRef(radiusKm);
useEffect(() => {
  latRef.current = lat;
  lngRef.current = lng;
  radiusKmRef.current = radiusKm;
}, [lat, lng, radiusKm]);

// Reset pan/zoom whenever the user changes settings
useEffect(() => {
  panOffsetRef.current = { dLat: 0, dLon: 0 };
  zoomLevelRef.current = 1;
}, [lat, lng, radiusKm]);
```

- [ ] **Step 2: Update the `drawRadar` call to use effective params**

In the rAF `loop` function inside the first `useEffect`, replace:

```tsx
      drawRadar({
        ctx,
        width: canvas.width,
        height: canvas.height,
        centerLat: lat,
        centerLon: lng,
        radiusKm,
        ringIntervals,
        aircraft,
        hoveredHex: hoveredHexRef.current,
        pinnedHexes: pinnedHexesRef.current,
        theme,
      });
```

with:

```tsx
      const effectiveLat = latRef.current + panOffsetRef.current.dLat;
      const effectiveLon = lngRef.current + panOffsetRef.current.dLon;
      const effectiveRadius = radiusKmRef.current / zoomLevelRef.current;
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
      });
```

- [ ] **Step 3: Update `hitTest` to use effective params**

Replace the existing `hitTest` useCallback:

```tsx
  const hitTest = useCallback(
    (clientX: number, clientY: number): string | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      const effectiveLat = latRef.current + panOffsetRef.current.dLat;
      const effectiveLon = lngRef.current + panOffsetRef.current.dLon;
      const effectiveRadius = radiusKmRef.current / zoomLevelRef.current;

      for (const ac of aircraftMap.values()) {
        const pos = latLonToCanvas(
          ac._renderLat, ac._renderLon,
          effectiveLat, effectiveLon, effectiveRadius,
          canvas.width, canvas.height
        );
        if (Math.hypot(mx - pos.x, my - pos.y) < 18) return ac.hex;
      }
      return null;
    },
    [aircraftMap]
  );
```

Note: `lat`, `lng`, `radiusKm` are removed from the dependency array — they're read from refs.

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests PASS (no test coverage for RadarView itself — the draw loop is visual)

- [ ] **Step 5: Commit**

```bash
git add src/components/RadarView/RadarView.tsx
git commit -m "feat: wire pan/zoom refs into draw loop and hit-test"
```

---

### Task 4: Add wheel handler, drag handlers, double-click reset, and cursor

**Files:**
- Modify: `src/components/RadarView/RadarView.tsx`

- [ ] **Step 1: Add drag refs and cursor state inside `RadarView`**

Add after the pan/zoom refs from Task 3:

```tsx
const isDragging = useRef(false);
const dragStart = useRef({ x: 0, y: 0 });
const hasMoved = useRef(false);
const [cursor, setCursor] = useState<'grab' | 'grabbing'>('grab');
```

- [ ] **Step 2: Register a non-passive wheel listener**

React's synthetic `onWheel` may be passive in some environments. Add this `useEffect` (after the resize observer effect):

```tsx
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left - canvas.width / 2;
      const my = e.clientY - rect.top - canvas.height / 2;
      const result = applyZoom(
        zoomLevelRef.current,
        panOffsetRef.current,
        mx, my,
        canvas.width, canvas.height,
        latRef.current, lngRef.current, radiusKmRef.current,
        e.deltaY
      );
      zoomLevelRef.current = result.zoomLevel;
      panOffsetRef.current = result.panOffset;
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);
```

- [ ] **Step 3: Replace the canvas JSX event handlers**

Replace the `<canvas>` element's current event props (`onClick`, `onMouseMove`, `onMouseLeave`) with the following. The `onClick` is replaced by `onMouseUp` (to allow click/drag disambiguation):

```tsx
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor }}
        onMouseDown={(e) => {
          isDragging.current = true;
          hasMoved.current = false;
          dragStart.current = { x: e.clientX, y: e.clientY };
          setCursor('grabbing');
        }}
        onMouseMove={(e) => {
          if (isDragging.current) {
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;
            if (!hasMoved.current && Math.hypot(dx, dy) < 4) return;
            hasMoved.current = true;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const effectiveLat = latRef.current + panOffsetRef.current.dLat;
            const effectiveRadius = radiusKmRef.current / zoomLevelRef.current;
            panOffsetRef.current = applyPan(
              panOffsetRef.current,
              dx, dy,
              effectiveLat, effectiveRadius,
              canvas.width, canvas.height
            );
            dragStart.current = { x: e.clientX, y: e.clientY };
            return;
          }
          setHoverPos({ x: e.clientX, y: e.clientY });
          setHovered(hitTest(e.clientX, e.clientY));
        }}
        onMouseUp={(e) => {
          const wasDrag = hasMoved.current;
          isDragging.current = false;
          hasMoved.current = false;
          setCursor('grab');
          if (!wasDrag) {
            const hex = hitTest(e.clientX, e.clientY);
            if (hex) pin(hex);
          }
        }}
        onMouseLeave={() => {
          isDragging.current = false;
          hasMoved.current = false;
          setCursor('grab');
          setHovered(null);
        }}
        onDoubleClick={() => {
          panOffsetRef.current = { dLat: 0, dLon: 0 };
          zoomLevelRef.current = 1;
        }}
      />
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/RadarView/RadarView.tsx
git commit -m "feat: add wheel zoom, drag pan, double-click reset to radar canvas"
```

---

## Manual Verification Checklist

After all tasks are complete, open the app (`npm run dev`) and verify:

- [ ] Mouse wheel zooms in/out — the point under the cursor stays fixed
- [ ] Click-drag pans the radar — aircraft move with the drag
- [ ] Left-click without dragging still selects/pins aircraft
- [ ] Double-click resets zoom and pan to default
- [ ] Opening settings and changing center lat/lon or radius resets the view
- [ ] Cursor is `grab` at rest, `grabbing` while dragging
- [ ] Hover tooltips still work after panning
