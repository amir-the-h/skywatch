# Radar Heading Rotation + Compass Labels

**Date:** 2026-06-11

## Overview

Add a heading input to settings so the user can rotate the radar to put their bearing at the top. Replace the current single `N` label with full 30° compass labels (N, 30, 60, E, 120, 150, S, 210, 240, W, 300, 330) positioned at the canvas edge.

---

## Settings

### `src/types/aircraft.ts`

Add `headingDeg` to the `Settings` interface:

```ts
headingDeg: number; // 0–359, degrees clockwise from north; 0 = north-up
```

Add to `DEFAULT_SETTINGS`:

```ts
headingDeg: 0,
```

### `src/components/SettingsPanel/SettingsModal.tsx`

Add a number input in the location section (after the elevation field):

- Label: `Radar heading (°)`
- `type="number"`, `min=0`, `max=359`, `step=1`
- Hint text below: `0 = north-up`
- Updates `settings.headingDeg` on change

---

## Canvas Rotation

### `src/components/RadarView/RadarCanvas.ts`

**`RadarDrawParams`** — add field:

```ts
headingDeg: number;
```

**`drawRadar`** — after filling the background, wrap all drawing in a rotation:

```ts
const cx = width / 2;
const cy = height / 2;
ctx.save();
ctx.translate(cx + panOffset.x, cy + panOffset.y);
ctx.rotate((-headingDeg * Math.PI) / 180);
ctx.translate(-(cx + panOffset.x), -(cy + panOffset.y));
// ... all existing drawing calls ...
ctx.restore();
```

`drawCardinals` is removed. `drawHeadingLabels` (see below) is called inside the rotation so every label naturally sits at its true compass position and the user's heading faces up.

---

## Heading Labels

### `drawHeadingLabels` (replaces `drawCardinals`)

Draws 12 labels at 30° increments around the canvas edge (same ~8 px inset as the current `N`).

| Bearing | Label | Style |
|---------|-------|-------|
| 0       | N     | bold  |
| 30      | 30    | normal |
| 60      | 60    | normal |
| 90      | E     | bold  |
| 120     | 120   | normal |
| 150     | 150   | normal |
| 180     | S     | bold  |
| 210     | 210   | normal |
| 240     | 240   | normal |
| 270     | W     | bold  |
| 300     | 300   | normal |
| 330     | 330   | normal |

**Placement formula** for each bearing `a` (radians):

```
edgeR = min(width, height) / 2 - 8
x = cx + sin(a) * edgeR
y = cy - cos(a) * edgeR
```

Cardinal labels (`N`, `E`, `S`, `W`) use `bold 13px monospace` and opacity `0.7`. Number labels use `11px monospace` and opacity `0.45`.

---

## Data Flow

```
useSettingsStore (headingDeg)
  → RadarView.tsx  (reads headingDeg, passes to drawRadar params)
  → drawRadar      (rotates context, calls drawHeadingLabels)
```

No backend changes required. `headingDeg` persists to `localStorage` via the existing `persist` middleware in `useSettings`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/types/aircraft.ts` | Add `headingDeg` to `Settings` + `DEFAULT_SETTINGS` |
| `src/components/SettingsPanel/SettingsModal.tsx` | Add heading input in location section |
| `src/components/RadarView/RadarCanvas.ts` | Add `headingDeg` to `RadarDrawParams`, apply rotation in `drawRadar`, replace `drawCardinals` with `drawHeadingLabels` |
| `src/components/RadarView/RadarView.tsx` | Pass `headingDeg` from settings into draw params |
