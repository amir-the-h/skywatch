# Radar Visual Improvements — Design Spec

**Date:** 2026-06-07

## Summary

Three visual improvements to the radar view:

1. **Selected aircraft fill** — pinned aircraft rendered with filled silhouette + color accent in side card
2. **Pinned card gaps** — add Origin → Destination route row and color the callsign with aircraft color
3. **Floating canvas labels** — every aircraft gets a persistent label bubble on the canvas, connected by a dashed line, showing callsign, altitude, trend arrow, speed, and flight phase badge

---

## 1. Selected Aircraft Highlight

### Canvas (`RadarCanvas.ts`)

Split the current `isHighlighted` flag into two separate booleans: `isPinned` and `isHovered`.

**Pinned (`pinnedHexes.has(ac.hex)`):**
- Fill the silhouette: `ctx.fill(p)` with aircraft color at 55% opacity
- Stroke on top: aircraft color, lineWidth 2.5, shadowBlur 20
- **No selection ring** — fill alone is the selection signal

**Hovered only (`hoveredHex === ac.hex && !isPinned`):**
- Outline-only (no fill), lineWidth 3, shadowBlur 14 — visually between normal and pinned

**Neither (default):**
- Outline-only, lineWidth 2, shadowBlur 8 (current behavior)

### Pinned card (`FlightBubble.tsx`)

- Callsign (`<strong>`) rendered in aircraft color — pass `color` prop from parent
- Left border on the card container: `border-left: 3px solid <aircraftColor>`
- Border color matches the aircraft color, giving a per-card visual identity

`FlightBubble` needs a `color: string` prop. Parent (`RadarView.tsx`) computes `aircraftColor(ac.t, theme)` and passes it down.

---

## 2. Pinned Card — Route Data

### API normalizer (`airplanesLive.ts`)

Add to `normalize()`:

```ts
orig_iata: raw.orig_iata ?? null,
dest_iata: raw.dest_iata ?? null,
orig_name: raw.orig_name ?? null,   // city name if provided
dest_name: raw.dest_name ?? null,
```

### Aircraft type (`aircraft.ts`)

Add optional fields:

```ts
orig_iata?: string;
dest_iata?: string;
orig_name?: string;
dest_name?: string;
```

### FlightBubble layout

Insert a route row between the type line and position data, rendered only when at least `orig_iata` or `dest_iata` is present:

```
IST → AYT
Istanbul → Antalya   (city names, shown only if available)
```

Styled with a subtle background tint in aircraft color (7% opacity fill, 20% opacity border).

---

## 3. Canvas Floating Labels (All Aircraft)

### Where

`RadarCanvas.ts` — new `drawAircraftLabels(params)` function, called after `drawAllAircraft` so labels render on top.

### Label contents (per aircraft)

```
[CALLSIGN]         ← aircraft color, bold, 9.5px monospace
[ALT] ft  [TREND]  ← white/light, trend arrow colored
[SPEED] kts        ← muted color, 8px
[PHASE]            ← small badge, color by phase
```

**Trend arrow:**
- `baro_rate > 100` fpm → `▲` green (`#4ade80`)
- `baro_rate < −100` fpm → `▼` red (`#f87171`)
- otherwise → `—` muted

**Phase badge (inferred, no new API field needed):**

Evaluated in order (first match wins):

| Badge | Condition |
|-------|-----------|
| `TXI` | `alt ≤ 500` ft and `gs` 5–50 kts |
| `GND` | `alt ≤ 500` ft and `gs < 5` kts |
| `T/O` | `alt < 3000` ft and `baro_rate > 1000` fpm |
| `APP` | `alt < 5000` ft and `baro_rate < −300` fpm |
| `CLB` | `baro_rate > 200` fpm |
| `DSC` | `baro_rate < −200` fpm |
| `CRZ` | otherwise |

`alt` here means the numeric altitude in feet. When `alt_baro` is the string `"ground"` (raw API value), treat as 0.

Phase badge colors: GND/TXI neutral-muted, T/O green, APP red, CLB green, DSC red, CRZ neutral.

### Label box

- Background: `rgba(10, 11, 15, 0.82)` (near-black, slightly transparent)
- Border: aircraft color, 1.2px stroke, 5px border-radius
- Size: ~100px wide × 52px tall (fixed, not dynamic)
- Drawn with `ctx.fillRect` + `ctx.strokeRect` + `ctx.fillText` calls — no HTML

### Connector line

- From aircraft center to nearest corner of label box
- Style: `setLineDash([3, 3])`, aircraft color, lineWidth 1, opacity 0.6
- Placement: label positioned in the quadrant **opposite** to the aircraft's heading line, to minimize overlap. Default quadrant = upper-right; shift to upper-left, lower-right, or lower-left based on heading direction and canvas edge proximity.

### Label positioning logic

```
offset = 40px from aircraft center
default: upper-right (dx=+40, dy=-40)
if aircraft near right edge (pos.x > width - 120): use upper-left
if aircraft near top edge (pos.y < 70): use lower-right (or lower-left)
```

This is best-effort — no full collision detection (too expensive at 60fps for 100+ aircraft). Labels may still overlap in dense areas, which is acceptable.

### Draw order in `drawRadar`

```
1. drawRings
2. drawGrid
3. drawCardinals
4. drawAllAircraft  (trails → silhouettes → heading lines)
5. drawAircraftLabels  ← new, always on top
```

---

## Data Flow

```
aircraftStore
  └─ aircraft map (hex → Aircraft with new orig_iata/dest_iata fields)

RadarCanvas.drawRadar(params)
  └─ drawAllAircraft
       └─ per aircraft: fill if pinned, stroke always
  └─ drawAircraftLabels
       └─ per aircraft: connector line + label box + text

FlightBubble(aircraft, color)
  └─ callsign in aircraft color
  └─ left border in aircraft color
  └─ route row (if orig_iata/dest_iata present)
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/types/aircraft.ts` | Add `orig_iata?`, `dest_iata?`, `orig_name?`, `dest_name?` |
| `src/api/airplanesLive.ts` | Normalize route fields from API response |
| `src/components/RadarView/RadarCanvas.ts` | Fill pinned aircraft; add `drawAircraftLabels` |
| `src/components/RadarView/RadarView.tsx` | Pass `color` prop to `FlightBubble` |
| `src/components/FlightBubble/FlightBubble.tsx` | Accept `color` prop; style callsign + border; add route row |

---

## Constraints

- Label placement is best-effort (edge avoidance only, no full collision detection)
- Route row hidden if both `orig_iata` and `dest_iata` are absent/null
- City names (`orig_name`, `dest_name`) shown only when non-empty
- Phase is derived client-side from existing fields — no new API field needed
- `alt_baro` can be the string `"ground"` from the API — treat as 0 in phase logic
