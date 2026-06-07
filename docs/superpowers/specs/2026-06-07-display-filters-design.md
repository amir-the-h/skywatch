# Display Settings & Aircraft Filters — Design Spec

**Date:** 2026-06-07  
**Status:** Approved

---

## Overview

Three configurable feature areas:

1. **Trail length** — how many historical positions are drawn behind each aircraft
2. **Label visibility** — conditions under which the radar canvas label box appears beside an aircraft
3. **Aircraft filters** — visual-only filtering by callsign, altitude, phase, manufacturer, model

---

## 1. Trail Length

### What changes
- New `trailLength: number` field added to the `Settings` type in `src/types/aircraft.ts`
- Default: `50` (current behavior — show all stored points)
- `PATH_HISTORY_MAX` in `aircraftStore.ts` stays at `50`; we always store up to 50 points and slice at render time

### Rendering
- `AircraftOverlay.tsx` (map view): `history.slice(-trailLength)` before building the Leaflet `Polyline`
- `RadarCanvas.ts`: same slice before the trail drawing loop
- `trailLength: 0` hides trails entirely

### Settings UI
- Range slider `0–50` in the settings modal, under a new "Display" section
- Helper label computed as `≈ ${Math.round(trailLength * refreshInterval / 60)} min` to give a human-readable hint

---

## 2. Label (Bubble) Visibility

### What changes
- New `labelConditions: Array<'always' | 'airport' | 'emergency' | 'pinned'>` in `Settings`
- Default: `['always']`
- Persisted alongside other settings

### Logic
```
if 'always' ∈ conditions → show label
else show label when any condition matches:
  'airport'   → inferFlightPhase(ac) ∈ { TXI, GND, T/O, APP }
  'emergency' → ac.emergency is set and !== 'none', or squawk ∈ { 7500, 7600, 7700 }
  'pinned'    → ac.hex ∈ pinnedHexes
```

### New helper
`src/lib/labelVisibility.ts`
```typescript
export function shouldShowLabel(
  ac: Aircraft,
  pinnedHexes: Set<string>,
  conditions: Settings['labelConditions']
): boolean
```

### Integration
- Called inside `drawAircraftLabels` in `RadarCanvas.ts` — skips the label box when false
- The silhouette icon and heading line always render regardless
- `pinnedHexes` already passed into `RadarDrawParams`; `labelConditions` added to that params struct

### Settings UI
- Four checkboxes in a new "Labels" subsection of the settings modal
- Checking `Always` unchecks and disables the other three (they become redundant)
- Unchecking `Always` re-enables them

---

## 3. Aircraft Filters

### State: `useFilterStore`
New ephemeral zustand store — **no persist middleware** (resets on page reload).

```typescript
// src/store/filterStore.ts
interface FilterState {
  callsign: string;      // partial, case-insensitive match on ac.flight
  altMin: number;        // default 0
  altMax: number;        // default 60000
  phases: FlightPhase[]; // empty = all phases pass
  manufacturer: string;  // partial match on ac.desc
  model: string;         // partial match on ac.t

  setCallsign: (v: string) => void;
  setAltRange: (min: number, max: number) => void;
  setPhases: (phases: FlightPhase[]) => void;
  setManufacturer: (v: string) => void;
  setModel: (v: string) => void;
  reset: () => void;
}
```

`isActive` is derived inline where needed:
```typescript
const isActive =
  filters.callsign !== '' ||
  filters.manufacturer !== '' ||
  filters.model !== '' ||
  filters.altMin > 0 ||
  filters.altMax < 60000 ||
  filters.phases.length > 0;
```

### Filter helper
`src/lib/aircraftFilter.ts`
```typescript
export function matchesFilter(ac: Aircraft, filters: FilterState): boolean
```

AND logic across fields: all active criteria must match. A field is "inactive" when it equals its default (empty string / 0 / 60000 / empty array).

### Integration points
- **MapView**: filter `aircraft` array after interpolation, before rendering markers and overlays
- **RadarView**:
  - Filter `aircraft` array before passing to `drawRadar`
  - Filter in `hitTest` so hidden aircraft are not hoverable or clickable
- **Label visibility**: `shouldShowLabel` is called only for aircraft that have already passed `matchesFilter` (filter gates first, label condition second)

---

## 4. Filter Drawer UI

New `FilterDrawer` component at `src/components/FilterDrawer/FilterDrawer.tsx`.  
Rendered at the bottom of both `MapView` and `RadarView` containers (absolutely positioned over the map/canvas).

### Collapsed state (default)
- Pill button bottom-left: filter icon + "Filters" label
- When `isActive`: red badge showing count of active filter fields; a row of dismissible chips. Clicking a chip clears that individual filter.
  - Callsign chip: shown when `callsign !== ''`, label `"{callsign} ×"`
  - Manufacturer chip: shown when `manufacturer !== ''`
  - Model chip: shown when `model !== ''`
  - Altitude chip: shown when `altMin > 0 || altMax < 60000`, label `"{altMin}–{altMax} ft ×"`
  - Phase chips: one chip per selected phase, e.g. `CLB ×`

### Expanded state
Slide-up panel with these controls:

| Control | Behavior |
|---|---|
| Callsign / flight | Text input, partial match on `ac.flight` |
| Manufacturer | Text input, partial match on `ac.desc` |
| Model | Text input, partial match on `ac.t` |
| Altitude range | Two number inputs (ft): min / max |
| Phase | Chip grid — all 7 phases toggle individually |
| Clear all | Button, visible only when `isActive` |

### Placement
`FilterDrawer` is a shared component imported by both `MapView` and `RadarView` — no duplication. The parent container must be `position: relative`.

---

## Files Changed / Created

| File | Change |
|---|---|
| `src/types/aircraft.ts` | Add `trailLength`, `labelConditions` to `Settings`; update `DEFAULT_SETTINGS` |
| `src/store/filterStore.ts` | New ephemeral zustand store |
| `src/lib/labelVisibility.ts` | New `shouldShowLabel` helper |
| `src/lib/aircraftFilter.ts` | New `matchesFilter` helper |
| `src/components/FilterDrawer/FilterDrawer.tsx` | New drawer component |
| `src/components/RadarView/RadarCanvas.ts` | Add `labelConditions` to params; gate labels via `shouldShowLabel`; slice trail |
| `src/components/RadarView/RadarView.tsx` | Filter aircraft before draw loop and hitTest |
| `src/components/MapView/MapView.tsx` | Filter aircraft before rendering |
| `src/components/MapView/AircraftOverlay.tsx` | Slice trail by `trailLength` |
| `src/components/SettingsPanel/SettingsModal.tsx` | Add trail slider and label condition checkboxes |
| `src/index.css` | Drawer styles |
