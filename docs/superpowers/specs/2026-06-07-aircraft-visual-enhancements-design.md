# Aircraft Visual Enhancements — Design Spec

**Date:** 2026-06-07

## Summary

Three visual improvements to aircraft rendering across both the radar (canvas) and map (Leaflet) views:

1. **Canvas view**: aircraft remain outline-only (already correct); map view fills them with the aircraft color for better tile contrast.
2. **Heading line**: a short dotted line extending from the aircraft nose in the direction of travel.
3. **Trail line**: a solid line tracing the path the aircraft took while tracked, capped at 50 positions.

---

## 1. Position History (Store Layer)

**File:** `src/store/aircraftStore.ts`

Add a new field:

```ts
pathHistory: Map<string, { lat: number; lon: number }[]>
```

- On every `mergeAircraft`, append the incoming `{ lat, lon }` for each aircraft to its history array, then slice to the last 50 entries.
- On `removeStale`, delete any `pathHistory` entries whose hex is no longer in the active set.
- The history uses raw `lat`/`lon` (not interpolated render coords) since it represents real received positions.

---

## 2. Color Helper

**File:** `src/lib/colorSystem.ts`

Add a `lightenColor(hex: string, amount: number): string` helper that parses an RGB hex color, converts to HSL, bumps lightness by `amount` (0–1), clamps to 100%, and returns the result as a hex string.

The trail line uses `lightenColor(color, 0.2)` — 20% brighter than the base aircraft color.

---

## 3. Canvas View (RadarCanvas)

**File:** `src/components/RadarView/RadarCanvas.ts`

### Aircraft silhouette
No change — already outline-only via `ctx.stroke(p)`.

### Heading line
After drawing each aircraft silhouette (before `ctx.restore()`), draw a dotted line in the aircraft's local coordinate system (pre-rotation):

- Start: `(0, -AIRCRAFT_SIZE * 0.5)` — approximately the nose tip offset
- End: `(0, -AIRCRAFT_SIZE * 0.5 - AIRCRAFT_SIZE * 5)` — 5× aircraft size forward
- Style: `setLineDash([4, 6])`, stroke with aircraft color, lineWidth 1.5, no shadow
- Reset dash after: `setLineDash([])`

### Trail line
Drawn before the aircraft silhouette (so it renders underneath), in world canvas coordinates:

- Convert each history `{ lat, lon }` to canvas `(x, y)` via `latLonToCanvas`
- Filter out points outside the canvas bounds + small margin
- Draw a `moveTo` / `lineTo` path through all points
- Style: solid, `lightenColor(color, 0.2)`, lineWidth 1.5, no shadow

`drawAllAircraft` receives `pathHistory` via `RadarDrawParams` (add the field).

---

## 4. Map View (AircraftMarker + AircraftOverlay)

### 4a. Aircraft fill

**File:** `src/components/MapView/AircraftMarker.tsx`

Change the SVG path from `fill="none"` to `fill="${color}"` with `fill-opacity="0.6"`. Keep the stroke as-is so the outline and glow remain.

### 4b. AircraftOverlay component (new)

**File:** `src/components/MapView/AircraftOverlay.tsx`

A new component that renders two Leaflet primitives alongside an aircraft:

**Heading polyline (dashed)**
- Calculate the endpoint: project ~5 km ahead from `(_renderLat, _renderLon)` along `track` degrees using a `bearingToLatLon` geo helper.
- Render as `<Polyline positions={[origin, endpoint]} dashArray="5 8" color={color} weight={1.5} opacity={0.8} />`

**Trail polyline (solid)**
- Read the aircraft's `pathHistory` from the store.
- Render as `<Polyline positions={history} color={lightenColor(color, 0.2)} weight={1.5} opacity={0.9} />`

Both polylines are omitted if their data is insufficient (trail < 2 points, no track for heading).

### 4c. MapView wiring

**File:** `src/components/MapView/MapView.tsx`

Render `<AircraftOverlay aircraft={ac} />` alongside each `<AircraftMarker aircraft={ac} />` inside the aircraft loop.

---

## 5. Geo Helper

**File:** `src/lib/geoUtils.ts`

Add `bearingToLatLon(lat: number, lon: number, bearingDeg: number, distanceKm: number): { lat: number; lon: number }` using the standard spherical Earth formula. Used by `AircraftOverlay` for the heading line endpoint.

---

## Data Flow

```
useAircraftFeed (polling)
  → mergeAircraft(incoming)
      → aircraftStore.aircraft (current positions + render state)
      → aircraftStore.pathHistory (capped at 50 per hex)

RadarCanvas.drawAllAircraft(params)
  → per aircraft: trail (from pathHistory) → silhouette → heading line

MapView
  → AircraftMarker (filled SVG icon)
  → AircraftOverlay (heading Polyline + trail Polyline)
```

---

## Constraints

- Trail history uses raw API lat/lon, not interpolated render positions, to represent real data points.
- Heading line length is fixed in visual units (canvas) or geographic units (map, 5 km) — not speed-proportional.
- The heading line is suppressed if `track` is absent or NaN.
- The trail is suppressed if fewer than 2 history points are recorded.
- `lightenColor` clamps lightness to [0, 1] to avoid invalid CSS.
