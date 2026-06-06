# Canvas Zoom & Pan — Design Spec
**Date:** 2026-06-07

## Overview

Add ephemeral zoom and pan to the RadarView canvas. "Ephemeral" means the view resets on page reload and does not persist to settings. The feel matches standard map navigation: scroll wheel to zoom toward cursor, left-click-drag to pan.

---

## State & Interaction Model

Two pieces of local state live in `RadarView`:

| State | Type | Default |
|---|---|---|
| `panOffset` | `{ dLat: number; dLon: number }` | `{ dLat: 0, dLon: 0 }` |
| `zoomLevel` | `number` | `1` |

**Effective view params** (computed, not stored):
```
effectiveLat    = lat + dLat
effectiveLon    = lng + dLon
effectiveRadius = radiusKm / zoomLevel
```

These replace `lat`, `lng`, `radiusKm` in every call to `drawRadar()` and `hitTest()`. No changes to those functions themselves.

### Gesture Map

| Gesture | Action |
|---|---|
| Mouse wheel | Zoom in/out toward cursor position |
| Left-click + drag | Pan (shift `panOffset`) |
| Left-click (no drag) | Aircraft selection (existing behavior, unchanged) |
| Double-click | Reset zoom and pan to defaults |

**Cursor:** `grab` by default, `grabbing` while actively dragging.

---

## Coordinate Math

### Panning

When the user drags by `(dx, dy)` pixels:

```
kmPerPx = effectiveRadius / (Math.min(canvasWidth, canvasHeight) / 2)
dLon   -= dx * kmPerPx / (111.0 * cos(effectiveLat * π / 180))
dLat   += dy * kmPerPx / 111.0
```

Sign rationale:
- Dragging right (positive `dx`) pulls map content right → center moves west → `dLon` decreases.
- Dragging down (positive `dy`) pulls map content down → center moves north → `dLat` increases.

### Zooming Toward Cursor

Mouse position relative to canvas center: `(mx, my)`.

```
scale = Math.min(w, h) / 2 / effectiveRadius

// Geo point currently under cursor
pointLat = effectiveLat - (my / scale) / 111.0
pointLon = effectiveLon + (mx / scale) / (111.0 * cos(effectiveLat * π / 180))

// Apply zoom
zoomLevel = clamp(zoomLevel * factor, 0.25, 20)

// Recompute effective params with new zoom
newEffectiveRadius = radiusKm / zoomLevel
newScale = Math.min(w, h) / 2 / newEffectiveRadius

// Adjust panOffset so the geo point stays under cursor
dLat = pointLat - lat + (my / newScale) / 111.0
dLon = pointLon - lng - (mx / newScale) / (111.0 * cos(pointLat * π / 180))
```

### Wheel Normalization

```
factor = Math.pow(0.999, event.deltaY)
```

`deltaY` varies across browsers and devices. `Math.pow(0.999, deltaY)` handles both discrete wheel clicks and smooth trackpad momentum correctly without special-casing.

### Click vs Drag Disambiguation

A drag is registered only if the pointer moves more than **4px** from the `mousedown` position. Below that threshold the `mouseup` fires aircraft selection as normal.

---

## Edge Cases

**Zoom limits:** `zoomLevel` clamped to `[0.25, 20]`. At 0.25× the visible radius is 4× the settings value (zoomed out); at 20× it is 1/20th (zoomed in tight).

**Pan limits:** None enforced. Panning off the data area shows an empty background, which is natural feedback. Double-click resets.

**Settings change while panned:** When `lat`, `lng`, or `radiusKm` changes in settings, reset both `panOffset` and `zoomLevel` to defaults. Prevents a disorienting "where am I?" state.

**Drag state in refs:** `isDragging`, `dragStart`, and `hasMoved` are refs, not React state, to avoid re-renders during mouse move.

**Touch / pinch:** Out of scope.

---

## Files Affected

| File | Change |
|---|---|
| `src/components/RadarView/RadarView.tsx` | Add zoom/pan state, wheel + drag handlers, pass effective params to `drawRadar` and `hitTest` |
| `src/lib/geoUtils.ts` | No changes needed |
| `src/components/RadarView/RadarCanvas.ts` | No changes needed |
