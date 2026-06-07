# Zoom-Aware Aircraft Scaling

**Date:** 2026-06-07  
**Status:** Approved

## Problem

Two related issues when zooming the radar:

1. **Disappear bug** — aircraft vanish at certain zoom+pan combinations. The canvas bounds check in `drawAllAircraft` (`RadarCanvas.ts:195`) ignores `panOffset`. An aircraft that is panned into the visible screen area can be culled before drawing because the check compares raw geo-mapped canvas coordinates against canvas dimensions, not screen coordinates.

2. **Fixed icon size feels wrong** — aircraft silhouettes stay at `AIRCRAFT_SIZE = 28px` regardless of zoom level. Zoom currently works by shrinking `effectiveRadius`, which spreads geographic features apart, but the icons themselves don't grow. The result is that zooming in doesn't feel like true zoom — everything spatial grows but the aircraft stay the same tiny size.

## Goal

When zooming in, aircraft icons, canvas-drawn callsign labels, and the hover tooltip (`FlightPreview`) should scale up proportionally so the experience feels like a genuine zoom. The pinned `FlightBubble` panel is explicitly excluded — it's a fixed UI panel unrelated to map position.

## Scaling Curve

**Dampened: `iconScale = Math.sqrt(zoomLevel)`**

- At zoom 1×: icons are baseline size
- At zoom 4×: icons are 2× bigger (not 4×)
- At zoom 9×: icons are 3× bigger

This keeps icons readable and proportional without becoming oversized at high zoom.

## Changes

### 1. Fix bounds culling — `RadarCanvas.ts`

**Location:** `drawAllAircraft`, line 195

Current check compares `pos.x/pos.y` (geo-mapped canvas coordinates) against raw canvas dimensions. After `ctx.translate(panOffset.x, panOffset.y)`, the actual screen position is `pos + panOffset`.

**Fix:** Adjust the culling check to screen space:

```ts
const screenX = pos.x + panOffset.x;
const screenY = pos.y + panOffset.y;
if (screenX < -padding || screenX > width + padding || screenY < -padding || screenY > height + padding) continue;
```

Where `padding = AIRCRAFT_SIZE * iconScale * 1.5` (generous enough to include the full icon).

### 2. Add `zoomLevel` to `RadarDrawParams` — `RadarCanvas.ts`

Add `zoomLevel: number` to the `RadarDrawParams` interface. Pass `zoomLevelRef.current` from the draw loop in `RadarView.tsx`. Both `drawAllAircraft` and `drawAircraftLabels` destructure it.

### 3. Scale aircraft icon — `drawAllAircraft`

Replace fixed `AIRCRAFT_SIZE` usage with:

```ts
const iconScale = Math.sqrt(zoomLevel);
const scaledSize = AIRCRAFT_SIZE * iconScale;
```

Apply `scaledSize` everywhere `AIRCRAFT_SIZE` is used:
- `ctx.scale(scaledSize / 200, scaledSize / 200)` for the silhouette
- `NOSE_OFFSET` and `HEADING_LINE_LENGTH` derive from `AIRCRAFT_SIZE` as constants — recompute them locally using `scaledSize`
- Hit-test radius in `RadarView.tsx` (`< 18`) should also scale: `< 18 * iconScale`

### 4. Scale canvas labels — `drawAircraftLabels`

All label geometry scales by `iconScale = Math.sqrt(zoomLevel)`:

| Element | Baseline | Scaled |
|---|---|---|
| Label width | `LABEL_W = 100` | `100 * iconScale` |
| Label height | `LABEL_H = 52` | `52 * iconScale` |
| Label offset | `LABEL_OFFSET = 40` | `40 * iconScale` |
| Callsign font | `9.5px` | `9.5 * iconScale px` |
| Alt/speed font | `8.5px / 8px` | scaled |
| Phase badge | `28×12` | scaled |
| Border radius | `5` | `5 * iconScale` |
| Padding/margins | `7px` | `7 * iconScale` |

Edge-detection for label quadrant (`pos.x > width - LABEL_W - 20`) also uses the scaled `LABEL_W`.

### 5. Scale FlightPreview — `FlightPreview.tsx` + `RadarView.tsx`

`FlightPreview` is a DOM element positioned at cursor coordinates. Scale it via CSS transform.

**`FlightPreview.tsx`:** Add `scale: number` prop. Apply:
```tsx
style={{ left: x + 12, top: y - 8, transform: `scale(${scale})`, transformOrigin: 'top left' }}
```

**`RadarView.tsx`:** Add `const [zoomScale, setZoomScale] = useState(1)`. In the wheel handler, after updating `zoomLevelRef.current`, call `setZoomScale(Math.sqrt(zoomLevelRef.current))`. Pass `zoomScale` to `<FlightPreview>`.

## What Is Not Changing

- `FlightBubble` pinned panel — fixed UI, not zoom-aware
- Ring labels, grid, cardinal directions — these are geographic features and correctly stay fixed-size
- Airport markers and labels — already scale naturally with `effectiveRadius`
- Trail line width — stays at `1.5px`; scaling trail thickness with zoom would be distracting

## Files to Modify

| File | Change |
|---|---|
| `src/components/RadarView/RadarCanvas.ts` | Fix bounds check; add `zoomLevel` param; scale icon + labels |
| `src/components/RadarView/RadarView.tsx` | Pass `zoomLevel` to `drawRadar`; add `zoomScale` state; pass to `FlightPreview` |
| `src/components/FlightBubble/FlightPreview.tsx` | Add `scale` prop; apply CSS transform |
