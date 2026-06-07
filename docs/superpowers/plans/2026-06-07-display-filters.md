# Display Settings & Aircraft Filters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable trail length, radar label visibility conditions, and a session-scoped aircraft filter drawer to the flight tracker.

**Architecture:** Trail length and label conditions are persisted display preferences added to the existing `Settings` type. Aircraft filters are ephemeral session state in a separate `useFilterStore`. A shared `FilterDrawer` component sits at the bottom of both MapView and RadarView. Two new pure helpers (`shouldShowLabel`, `matchesFilter`) contain all the logic and are unit-tested independently.

**Tech Stack:** React, TypeScript, Zustand, Vitest, jsdom. Test command: `npm test`. Run a single test file: `npx vitest run src/lib/labelVisibility.test.ts`.

---

## File Map

| File | Change |
|---|---|
| `src/types/aircraft.ts` | Add `LabelCondition` type, `trailLength` and `labelConditions` to `Settings` |
| `src/lib/labelVisibility.ts` | New — `shouldShowLabel` pure helper |
| `src/lib/labelVisibility.test.ts` | New — unit tests for `shouldShowLabel` |
| `src/lib/aircraftFilter.ts` | New — `matchesFilter` pure helper |
| `src/lib/aircraftFilter.test.ts` | New — unit tests for `matchesFilter` |
| `src/store/filterStore.ts` | New — ephemeral `useFilterStore` + `isFilterActive` |
| `src/components/FilterDrawer/FilterDrawer.tsx` | New — collapsible filter drawer |
| `src/components/MapView/AircraftOverlay.tsx` | Slice trail by `trailLength` |
| `src/components/MapView/MapView.tsx` | Filter aircraft array; add `<FilterDrawer />` |
| `src/components/RadarView/RadarCanvas.ts` | Add `trailLength` + `labelConditions` to params; gate labels |
| `src/components/RadarView/RadarView.tsx` | Pass new params; filter aircraft + hitTest |
| `src/components/SettingsPanel/SettingsModal.tsx` | Add trail slider + label condition checkboxes |
| `src/index.css` | FilterDrawer styles |

---

## Task 1: Add `trailLength` to Settings and apply in AircraftOverlay

**Files:**
- Modify: `src/types/aircraft.ts`
- Modify: `src/components/MapView/AircraftOverlay.tsx`

- [ ] **Step 1: Update `Settings` type**

In `src/types/aircraft.ts`, add `trailLength: number` to the `Settings` interface and set its default:

```typescript
export interface Settings {
  lat: number;
  lng: number;
  radiusKm: number;
  refreshInterval: number;
  theme: 'dark' | 'light';
  tileSource: 'osm' | 'satellite';
  view: 'map' | 'radar';
  ringIntervals: number[];
  trailLength: number;      // how many path-history points to draw (0–50)
}

export const DEFAULT_SETTINGS: Settings = {
  lat: 41.0082,
  lng: 28.9784,
  radiusKm: 150,
  refreshInterval: 5,
  theme: 'dark',
  tileSource: 'osm',
  view: 'map',
  ringIntervals: [25, 50, 100, 150],
  trailLength: 50,
};
```

- [ ] **Step 2: Apply trail slice in AircraftOverlay**

Replace `src/components/MapView/AircraftOverlay.tsx` with:

```tsx
import { Polyline } from 'react-leaflet';
import type { Aircraft } from '../../types/aircraft';
import { aircraftColor } from '../../lib/colorSystem';
import { lightenHsl } from '../../lib/colorSystem';
import { bearingToLatLon } from '../../lib/geoUtils';
import { useAircraftStore } from '../../store/aircraftStore';
import { useSettingsStore } from '../../hooks/useSettings';

interface Props {
  aircraft: Aircraft;
}

const HEADING_KM = 5;

export function AircraftOverlay({ aircraft }: Props) {
  const theme = useSettingsStore((s) => s.theme);
  const trailLength = useSettingsStore((s) => s.trailLength);
  const pathHistory = useAircraftStore((s) => s.pathHistory);

  const color = aircraftColor(aircraft.t, theme);
  const trailColor = lightenHsl(color, 0.2);
  const fullHistory = pathHistory.get(aircraft.hex) ?? [];
  const history = trailLength > 0 ? fullHistory.slice(-trailLength) : [];

  const hasTrack = aircraft.track != null && !Number.isNaN(aircraft.track);
  const headingEnd = hasTrack
    ? bearingToLatLon(aircraft._renderLat, aircraft._renderLon, aircraft.track, HEADING_KM)
    : null;

  return (
    <>
      {history.length >= 2 && (
        <Polyline
          positions={history.map((p) => [p.lat, p.lon] as [number, number])}
          color={trailColor}
          weight={1.5}
          opacity={0.9}
        />
      )}
      {headingEnd && (
        <Polyline
          positions={[
            [aircraft._renderLat, aircraft._renderLon],
            [headingEnd.lat, headingEnd.lon],
          ]}
          color={color}
          weight={1.5}
          opacity={0.8}
          dashArray="5 8"
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/aircraft.ts src/components/MapView/AircraftOverlay.tsx
git commit -m "feat: add trailLength setting, apply in map view trail"
```

---

## Task 2: Apply trail length in RadarCanvas + settings UI slider

**Files:**
- Modify: `src/components/RadarView/RadarCanvas.ts`
- Modify: `src/components/RadarView/RadarView.tsx`
- Modify: `src/components/SettingsPanel/SettingsModal.tsx`

- [ ] **Step 1: Add `trailLength` to `RadarDrawParams`**

In `src/components/RadarView/RadarCanvas.ts`, update `RadarDrawParams`:

```typescript
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
  trailLength: number;    // NEW
}
```

Then in `drawAllAircraft`, destructure `trailLength` and slice the history:

```typescript
function drawAllAircraft(params: RadarDrawParams): Map<string, AircraftRenderData> {
  const { ctx, width, height, centerLat, centerLon, radiusKm, aircraft, hoveredHex, pinnedHexes, theme, pathHistory, trailLength } = params;

  const renderData = new Map<string, AircraftRenderData>();

  for (const ac of aircraft) {
    const pos = latLonToCanvas(ac._renderLat, ac._renderLon, centerLat, centerLon, radiusKm, width, height);
    if (pos.x < -20 || pos.x > width + 20 || pos.y < -20 || pos.y > height + 20) continue;

    const color = aircraftColor(ac.t, theme);
    renderData.set(ac.hex, { pos, color });
    const family = getAircraftFamily(ac.t);
    const pathStr = SILHOUETTE_PATHS[family];
    const isPinned = pinnedHexes.has(ac.hex);
    const isHovered = hoveredHex === ac.hex && !isPinned;
    const isEmergency = (!!ac.emergency && ac.emergency !== 'none') || ac.squawk === '7700' || ac.squawk === '7600' || ac.squawk === '7500';

    // Trail — slice to configured length
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
    ctx.scale(AIRCRAFT_SIZE / 200, AIRCRAFT_SIZE / 200);

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
      const noseX = pos.x + Math.sin(trackRad) * NOSE_OFFSET;
      const noseY = pos.y - Math.cos(trackRad) * NOSE_OFFSET;

      ctx.save();
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.7;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(noseX, noseY);
      ctx.lineTo(
        noseX + Math.sin(trackRad) * HEADING_LINE_LENGTH,
        noseY - Math.cos(trackRad) * HEADING_LINE_LENGTH
      );
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  return renderData;
}
```

- [ ] **Step 2: Pass `trailLength` from RadarView to `drawRadar`**

In `src/components/RadarView/RadarView.tsx`, destructure `trailLength` from the settings store:

```typescript
const { lat, lng, radiusKm, ringIntervals, theme, trailLength } = useSettingsStore();
```

Then pass it in the `drawRadar` call:

```typescript
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
  trailLength,
});
```

Also mirror it into a ref so the RAF loop reads fresh values (add this alongside the other refs):

```typescript
const trailLengthRef = useRef(trailLength);
useEffect(() => { trailLengthRef.current = trailLength; }, [trailLength]);
```

And use `trailLengthRef.current` in the `drawRadar` call inside the RAF loop:

```typescript
drawRadar({
  // ...other params...
  trailLength: trailLengthRef.current,
});
```

- [ ] **Step 3: Add trail length slider to SettingsModal**

In `src/components/SettingsPanel/SettingsModal.tsx`, add a "Display" section before the existing labels. Add this block inside `modal-body`, after the "Refresh interval" label:

```tsx
<div className="modal-section-title">Display</div>

<label>
  Trail length
  <input
    type="range"
    min={0}
    max={50}
    value={settings.trailLength}
    onChange={(e) => settings.update({ trailLength: parseInt(e.target.value) })}
  />
  <span>
    {settings.trailLength === 0
      ? 'Hidden'
      : `${settings.trailLength} pts · ≈${Math.round(settings.trailLength * settings.refreshInterval / 60)} min`}
  </span>
</label>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/RadarView/RadarCanvas.ts src/components/RadarView/RadarView.tsx src/components/SettingsPanel/SettingsModal.tsx
git commit -m "feat: apply trailLength in radar view and add settings slider"
```

---

## Task 3: `shouldShowLabel` helper — TDD

**Files:**
- Modify: `src/types/aircraft.ts`
- Create: `src/lib/labelVisibility.ts`
- Create: `src/lib/labelVisibility.test.ts`

- [ ] **Step 1: Add `LabelCondition` type to `src/types/aircraft.ts`**

Add this type alias directly after the `AircraftFamily` type (before the `Aircraft` interface):

```typescript
export type LabelCondition = 'always' | 'airport' | 'emergency' | 'pinned';
```

This type is needed by both the helper and the Settings interface (added in Task 4).

- [ ] **Step 2: Write the failing tests**

Create `src/lib/labelVisibility.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { shouldShowLabel } from './labelVisibility';
import type { Aircraft } from '../types/aircraft';
import type { LabelCondition } from '../types/aircraft';

function ac(overrides: Partial<Aircraft> = {}): Aircraft {
  return {
    hex: 'aaa', flight: 'TK1', r: 'TC-A', t: 'B738',
    lat: 41, lon: 28, alt_baro: 35000, gs: 480, track: 0,
    baro_rate: 0, seen: 1,
    _renderLat: 41, _renderLon: 28, _lastSeen: 0,
    ...overrides,
  };
}

const emptyPinned = new Set<string>();
const withPinned = (hex: string) => new Set([hex]);

describe('shouldShowLabel', () => {
  describe("'always' condition", () => {
    it('returns true for any aircraft when always is set', () => {
      expect(shouldShowLabel(ac(), emptyPinned, ['always'])).toBe(true);
    });

    it('returns true even when other conditions would not match', () => {
      expect(shouldShowLabel(ac({ alt_baro: 35000, baro_rate: 0 }), emptyPinned, ['always'])).toBe(true);
    });
  });

  describe("'airport' condition", () => {
    it('returns true for taxiing aircraft', () => {
      expect(shouldShowLabel(ac({ alt_baro: 200, gs: 25 }), emptyPinned, ['airport'])).toBe(true);
    });

    it('returns true for ground aircraft', () => {
      expect(shouldShowLabel(ac({ alt_baro: 100, gs: 2 }), emptyPinned, ['airport'])).toBe(true);
    });

    it('returns true for takeoff aircraft', () => {
      expect(shouldShowLabel(ac({ alt_baro: 2000, gs: 160, baro_rate: 1500 }), emptyPinned, ['airport'])).toBe(true);
    });

    it('returns true for approach aircraft', () => {
      expect(shouldShowLabel(ac({ alt_baro: 3000, gs: 180, baro_rate: -600 }), emptyPinned, ['airport'])).toBe(true);
    });

    it('returns false for cruising aircraft', () => {
      expect(shouldShowLabel(ac({ alt_baro: 35000, baro_rate: 0 }), emptyPinned, ['airport'])).toBe(false);
    });
  });

  describe("'emergency' condition", () => {
    it('returns true for squawk 7700', () => {
      expect(shouldShowLabel(ac({ squawk: '7700' }), emptyPinned, ['emergency'])).toBe(true);
    });

    it('returns true for squawk 7600', () => {
      expect(shouldShowLabel(ac({ squawk: '7600' }), emptyPinned, ['emergency'])).toBe(true);
    });

    it('returns true for squawk 7500', () => {
      expect(shouldShowLabel(ac({ squawk: '7500' }), emptyPinned, ['emergency'])).toBe(true);
    });

    it('returns true when emergency field is set', () => {
      expect(shouldShowLabel(ac({ emergency: 'general' }), emptyPinned, ['emergency'])).toBe(true);
    });

    it('returns false when emergency is "none"', () => {
      expect(shouldShowLabel(ac({ emergency: 'none' }), emptyPinned, ['emergency'])).toBe(false);
    });

    it('returns false for normal aircraft', () => {
      expect(shouldShowLabel(ac(), emptyPinned, ['emergency'])).toBe(false);
    });
  });

  describe("'pinned' condition", () => {
    it('returns true when aircraft is pinned', () => {
      expect(shouldShowLabel(ac({ hex: 'aaa' }), withPinned('aaa'), ['pinned'])).toBe(true);
    });

    it('returns false when aircraft is not pinned', () => {
      expect(shouldShowLabel(ac({ hex: 'aaa' }), withPinned('bbb'), ['pinned'])).toBe(false);
    });
  });

  describe('combinable conditions', () => {
    it('returns true when any condition matches', () => {
      // emergency squawk, airport condition not set — but emergency is
      expect(shouldShowLabel(ac({ squawk: '7700' }), emptyPinned, ['airport', 'emergency'])).toBe(true);
    });

    it('returns false when no condition matches', () => {
      expect(shouldShowLabel(ac({ alt_baro: 35000, baro_rate: 0 }), emptyPinned, ['airport', 'pinned'])).toBe(false);
    });
  });

  describe('empty conditions', () => {
    it('returns false when conditions array is empty', () => {
      expect(shouldShowLabel(ac(), emptyPinned, [])).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run src/lib/labelVisibility.test.ts
```

Expected: FAIL — "Cannot find module './labelVisibility'"

- [ ] **Step 3: Implement `shouldShowLabel`**

Create `src/lib/labelVisibility.ts`:

```typescript
import type { Aircraft, LabelCondition } from '../types/aircraft';
import { inferFlightPhase } from './flightPhase';

const AIRPORT_PHASES = new Set(['TXI', 'GND', 'T/O', 'APP']);
const EMERGENCY_SQUAWKS = new Set(['7500', '7600', '7700']);

export function shouldShowLabel(
  ac: Aircraft,
  pinnedHexes: Set<string>,
  conditions: LabelCondition[]
): boolean {
  if (conditions.includes('always')) return true;
  if (conditions.includes('airport') && AIRPORT_PHASES.has(inferFlightPhase(ac))) return true;
  if (conditions.includes('emergency')) {
    const sq = ac.squawk ?? '';
    const em = ac.emergency ?? '';
    if (EMERGENCY_SQUAWKS.has(sq) || (em !== '' && em !== 'none')) return true;
  }
  if (conditions.includes('pinned') && pinnedHexes.has(ac.hex)) return true;
  return false;
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/lib/labelVisibility.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/aircraft.ts src/lib/labelVisibility.ts src/lib/labelVisibility.test.ts
git commit -m "feat: add LabelCondition type and shouldShowLabel helper with tests"
```

---

## Task 4: Add `labelConditions` to Settings + SettingsModal checkboxes

**Files:**
- Modify: `src/types/aircraft.ts`
- Modify: `src/components/SettingsPanel/SettingsModal.tsx`

- [ ] **Step 1: Add `labelConditions` to Settings type**

`LabelCondition` was already added to `src/types/aircraft.ts` in Task 3. Now add the field to `Settings` and its default.

Add to `Settings` interface:

```typescript
export interface Settings {
  lat: number;
  lng: number;
  radiusKm: number;
  refreshInterval: number;
  theme: 'dark' | 'light';
  tileSource: 'osm' | 'satellite';
  view: 'map' | 'radar';
  ringIntervals: number[];
  trailLength: number;
  labelConditions: LabelCondition[];    // NEW
}
```

Add to `DEFAULT_SETTINGS`:

```typescript
export const DEFAULT_SETTINGS: Settings = {
  lat: 41.0082,
  lng: 28.9784,
  radiusKm: 150,
  refreshInterval: 5,
  theme: 'dark',
  tileSource: 'osm',
  view: 'map',
  ringIntervals: [25, 50, 100, 150],
  trailLength: 50,
  labelConditions: ['always'],    // NEW
};
```

- [ ] **Step 2: Add label condition checkboxes to SettingsModal**

In `src/components/SettingsPanel/SettingsModal.tsx`, add a helper to toggle a condition and add the UI block. First add the helper function inside the component:

```tsx
function toggleCondition(condition: LabelCondition) {
  if (condition === 'always') {
    // toggling "always" on clears others; toggling off resets to nothing
    const next = settings.labelConditions.includes('always') ? [] : ['always' as LabelCondition];
    settings.update({ labelConditions: next });
    return;
  }
  // removing 'always' implicitly when toggling a specific condition
  const without = settings.labelConditions.filter((c) => c !== 'always' && c !== condition);
  const next = settings.labelConditions.includes(condition)
    ? without
    : [...without, condition];
  settings.update({ labelConditions: next });
}
```

You'll also need to import `LabelCondition` at the top:

```tsx
import type { LabelCondition } from '../../types/aircraft';
```

Add this UI block inside `modal-body`, after the trail length label:

```tsx
<div className="modal-section-title">Labels</div>

{(['always', 'airport', 'emergency', 'pinned'] as LabelCondition[]).map((cond) => {
  const checked = settings.labelConditions.includes(cond);
  const disabled = cond !== 'always' && settings.labelConditions.includes('always');
  const labels: Record<LabelCondition, string> = {
    always: 'Always (show all)',
    airport: 'Airport ops (taxi / T/O / landing)',
    emergency: 'Emergency / unusual squawk',
    pinned: 'Pinned aircraft',
  };
  return (
    <label key={cond} className={disabled ? 'label-disabled' : ''}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={() => toggleCondition(cond)}
      />
      {labels[cond]}
    </label>
  );
})}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/aircraft.ts src/components/SettingsPanel/SettingsModal.tsx
git commit -m "feat: add labelConditions setting and settings UI checkboxes"
```

---

## Task 5: Wire `shouldShowLabel` into RadarCanvas

**Files:**
- Modify: `src/components/RadarView/RadarCanvas.ts`
- Modify: `src/components/RadarView/RadarView.tsx`

- [ ] **Step 1: Add `labelConditions` to `RadarDrawParams`**

In `src/components/RadarView/RadarCanvas.ts`, update the import and params:

```typescript
import type { Aircraft, LabelCondition } from '../../types/aircraft';
```

Add to `RadarDrawParams`:

```typescript
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
  labelConditions: LabelCondition[];    // NEW
}
```

Add the import for `shouldShowLabel` at the top of the file:

```typescript
import { shouldShowLabel } from '../../lib/labelVisibility';
```

- [ ] **Step 2: Gate label rendering in `drawAircraftLabels`**

In `drawAircraftLabels`, destructure `labelConditions` and `pinnedHexes` from params, then skip aircraft where `shouldShowLabel` returns false:

```typescript
function drawAircraftLabels(params: RadarDrawParams, renderData: Map<string, AircraftRenderData>) {
  const { ctx, width, height, aircraft, theme, labelConditions, pinnedHexes } = params;
  const textColor = theme === 'dark' ? '#e5e7eb' : '#1f2937';

  for (const ac of aircraft) {
    const rd = renderData.get(ac.hex);
    if (!rd) continue;
    if (!shouldShowLabel(ac, pinnedHexes, labelConditions)) continue;   // NEW gate

    const { pos, color } = rd;
    // ... rest of the existing label drawing code unchanged ...
```

- [ ] **Step 3: Pass `labelConditions` from RadarView**

In `src/components/RadarView/RadarView.tsx`, destructure `labelConditions` from the settings store:

```typescript
const { lat, lng, radiusKm, ringIntervals, theme, trailLength, labelConditions } = useSettingsStore();
```

Mirror it into a ref:

```typescript
const labelConditionsRef = useRef(labelConditions);
useEffect(() => { labelConditionsRef.current = labelConditions; }, [labelConditions]);
```

Pass it in the `drawRadar` call:

```typescript
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
});
```

- [ ] **Step 4: Verify TypeScript compiles and tests pass**

```bash
npx tsc --noEmit && npm test
```

Expected: no type errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/RadarView/RadarCanvas.ts src/components/RadarView/RadarView.tsx
git commit -m "feat: gate radar labels with shouldShowLabel based on labelConditions setting"
```

---

## Task 6: `matchesFilter` helper — TDD

**Files:**
- Create: `src/lib/aircraftFilter.ts`
- Create: `src/lib/aircraftFilter.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/aircraftFilter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { matchesFilter } from './aircraftFilter';
import type { Aircraft } from '../types/aircraft';
import type { FilterCriteria } from './aircraftFilter';

function ac(overrides: Partial<Aircraft> = {}): Aircraft {
  return {
    hex: 'aaa', flight: 'UAL123', r: 'N123UA', t: 'B738',
    desc: 'BOEING 737-800',
    lat: 41, lon: 28, alt_baro: 35000, gs: 480, track: 0,
    baro_rate: 0, seen: 1,
    _renderLat: 41, _renderLon: 28, _lastSeen: 0,
    ...overrides,
  };
}

const defaults: FilterCriteria = {
  callsign: '',
  altMin: 0,
  altMax: 60000,
  phases: [],
  manufacturer: '',
  model: '',
};

describe('matchesFilter', () => {
  it('passes all aircraft when all criteria are defaults', () => {
    expect(matchesFilter(ac(), defaults)).toBe(true);
  });

  describe('callsign filter', () => {
    it('matches partial callsign case-insensitively', () => {
      expect(matchesFilter(ac({ flight: 'UAL123' }), { ...defaults, callsign: 'ual' })).toBe(true);
    });

    it('rejects non-matching callsign', () => {
      expect(matchesFilter(ac({ flight: 'RYR456' }), { ...defaults, callsign: 'ual' })).toBe(false);
    });

    it('passes when callsign filter is empty', () => {
      expect(matchesFilter(ac({ flight: 'RYR456' }), { ...defaults, callsign: '' })).toBe(true);
    });

    it('handles aircraft with no flight field', () => {
      expect(matchesFilter(ac({ flight: '' }), { ...defaults, callsign: 'ual' })).toBe(false);
    });
  });

  describe('altitude filter', () => {
    it('passes aircraft within range', () => {
      expect(matchesFilter(ac({ alt_baro: 20000 }), { ...defaults, altMin: 10000, altMax: 30000 })).toBe(true);
    });

    it('rejects aircraft below minimum', () => {
      expect(matchesFilter(ac({ alt_baro: 5000 }), { ...defaults, altMin: 10000, altMax: 30000 })).toBe(false);
    });

    it('rejects aircraft above maximum', () => {
      expect(matchesFilter(ac({ alt_baro: 40000 }), { ...defaults, altMin: 10000, altMax: 30000 })).toBe(false);
    });

    it('passes at exact boundary values', () => {
      expect(matchesFilter(ac({ alt_baro: 10000 }), { ...defaults, altMin: 10000, altMax: 30000 })).toBe(true);
      expect(matchesFilter(ac({ alt_baro: 30000 }), { ...defaults, altMin: 10000, altMax: 30000 })).toBe(true);
    });
  });

  describe('phase filter', () => {
    it('passes all aircraft when phases array is empty', () => {
      expect(matchesFilter(ac({ alt_baro: 35000, baro_rate: 0 }), { ...defaults, phases: [] })).toBe(true);
    });

    it('passes aircraft in matching phase', () => {
      // CRZ: level at cruise altitude
      expect(matchesFilter(ac({ alt_baro: 35000, baro_rate: 0 }), { ...defaults, phases: ['CRZ'] })).toBe(true);
    });

    it('rejects aircraft not in selected phases', () => {
      expect(matchesFilter(ac({ alt_baro: 35000, baro_rate: 0 }), { ...defaults, phases: ['CLB', 'DSC'] })).toBe(false);
    });

    it('passes when aircraft matches any selected phase', () => {
      // CLB: baro_rate > 200
      expect(matchesFilter(ac({ alt_baro: 20000, baro_rate: 500 }), { ...defaults, phases: ['CLB', 'CRZ'] })).toBe(true);
    });
  });

  describe('manufacturer filter', () => {
    it('matches partial manufacturer in ac.desc case-insensitively', () => {
      expect(matchesFilter(ac({ desc: 'BOEING 737-800' }), { ...defaults, manufacturer: 'boeing' })).toBe(true);
    });

    it('rejects non-matching manufacturer', () => {
      expect(matchesFilter(ac({ desc: 'BOEING 737-800' }), { ...defaults, manufacturer: 'airbus' })).toBe(false);
    });

    it('passes when manufacturer is empty', () => {
      expect(matchesFilter(ac(), { ...defaults, manufacturer: '' })).toBe(true);
    });

    it('passes when aircraft has no desc and filter is empty', () => {
      expect(matchesFilter(ac({ desc: undefined }), { ...defaults, manufacturer: '' })).toBe(true);
    });

    it('rejects when aircraft has no desc and filter is set', () => {
      expect(matchesFilter(ac({ desc: undefined }), { ...defaults, manufacturer: 'boeing' })).toBe(false);
    });
  });

  describe('model filter', () => {
    it('matches partial model in ac.t case-insensitively', () => {
      expect(matchesFilter(ac({ t: 'B738' }), { ...defaults, model: 'b73' })).toBe(true);
    });

    it('rejects non-matching model', () => {
      expect(matchesFilter(ac({ t: 'B738' }), { ...defaults, model: 'a320' })).toBe(false);
    });
  });

  describe('AND logic across fields', () => {
    it('requires all active criteria to match', () => {
      // callsign matches but phase doesn't
      expect(matchesFilter(
        ac({ flight: 'UAL123', alt_baro: 35000, baro_rate: 0 }),
        { ...defaults, callsign: 'ual', phases: ['CLB'] }
      )).toBe(false);
    });

    it('passes when all criteria match', () => {
      expect(matchesFilter(
        ac({ flight: 'UAL123', alt_baro: 35000, baro_rate: 0 }),
        { ...defaults, callsign: 'ual', phases: ['CRZ'] }
      )).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run src/lib/aircraftFilter.test.ts
```

Expected: FAIL — "Cannot find module './aircraftFilter'"

- [ ] **Step 3: Implement `matchesFilter`**

Create `src/lib/aircraftFilter.ts`:

```typescript
import type { Aircraft } from '../types/aircraft';
import type { FlightPhase } from './flightPhase';
import { inferFlightPhase } from './flightPhase';

export interface FilterCriteria {
  callsign: string;
  altMin: number;
  altMax: number;
  phases: FlightPhase[];
  manufacturer: string;
  model: string;
}

export function matchesFilter(ac: Aircraft, filters: FilterCriteria): boolean {
  if (filters.callsign !== '' && !ac.flight?.toLowerCase().includes(filters.callsign.toLowerCase())) return false;
  if (ac.alt_baro < filters.altMin || ac.alt_baro > filters.altMax) return false;
  if (filters.phases.length > 0 && !filters.phases.includes(inferFlightPhase(ac))) return false;
  if (filters.manufacturer !== '' && !ac.desc?.toLowerCase().includes(filters.manufacturer.toLowerCase())) return false;
  if (filters.model !== '' && !ac.t?.toLowerCase().includes(filters.model.toLowerCase())) return false;
  return true;
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/lib/aircraftFilter.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/aircraftFilter.ts src/lib/aircraftFilter.test.ts
git commit -m "feat: add matchesFilter helper with tests"
```

---

## Task 7: Filter store

**Files:**
- Create: `src/store/filterStore.ts`

- [ ] **Step 1: Create the ephemeral filter store**

Create `src/store/filterStore.ts`:

```typescript
import { create } from 'zustand';
import type { FlightPhase } from '../lib/flightPhase';
import type { FilterCriteria } from '../lib/aircraftFilter';

const DEFAULT_ALT_MIN = 0;
const DEFAULT_ALT_MAX = 60000;

const DEFAULT_FILTER: FilterCriteria = {
  callsign: '',
  altMin: DEFAULT_ALT_MIN,
  altMax: DEFAULT_ALT_MAX,
  phases: [],
  manufacturer: '',
  model: '',
};

interface FilterStore extends FilterCriteria {
  setCallsign: (v: string) => void;
  setAltRange: (min: number, max: number) => void;
  setPhases: (phases: FlightPhase[]) => void;
  setManufacturer: (v: string) => void;
  setModel: (v: string) => void;
  reset: () => void;
}

export const useFilterStore = create<FilterStore>((set) => ({
  ...DEFAULT_FILTER,
  setCallsign: (callsign) => set({ callsign }),
  setAltRange: (altMin, altMax) => set({ altMin, altMax }),
  setPhases: (phases) => set({ phases }),
  setManufacturer: (manufacturer) => set({ manufacturer }),
  setModel: (model) => set({ model }),
  reset: () => set(DEFAULT_FILTER),
}));

export function isFilterActive(f: FilterCriteria): boolean {
  return (
    f.callsign !== '' ||
    f.manufacturer !== '' ||
    f.model !== '' ||
    f.altMin > DEFAULT_ALT_MIN ||
    f.altMax < DEFAULT_ALT_MAX ||
    f.phases.length > 0
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/store/filterStore.ts
git commit -m "feat: add ephemeral useFilterStore"
```

---

## Task 8: FilterDrawer component + CSS

**Files:**
- Create: `src/components/FilterDrawer/FilterDrawer.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Create the FilterDrawer component**

Create `src/components/FilterDrawer/FilterDrawer.tsx`:

```tsx
import { useState } from 'react';
import { useFilterStore, isFilterActive } from '../../store/filterStore';
import type { FlightPhase } from '../../lib/flightPhase';

const ALL_PHASES: FlightPhase[] = ['TXI', 'GND', 'T/O', 'APP', 'CLB', 'DSC', 'CRZ'];
const DEFAULT_ALT_MIN = 0;
const DEFAULT_ALT_MAX = 60000;

export function FilterDrawer() {
  const [open, setOpen] = useState(false);
  const filters = useFilterStore();
  const active = isFilterActive(filters);

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.callsign) {
    chips.push({ key: 'callsign', label: filters.callsign, clear: () => filters.setCallsign('') });
  }
  if (filters.manufacturer) {
    chips.push({ key: 'mfr', label: `mfr:${filters.manufacturer}`, clear: () => filters.setManufacturer('') });
  }
  if (filters.model) {
    chips.push({ key: 'model', label: `mdl:${filters.model}`, clear: () => filters.setModel('') });
  }
  if (filters.altMin > DEFAULT_ALT_MIN || filters.altMax < DEFAULT_ALT_MAX) {
    chips.push({
      key: 'alt',
      label: `${filters.altMin.toLocaleString()}–${filters.altMax.toLocaleString()} ft`,
      clear: () => filters.setAltRange(DEFAULT_ALT_MIN, DEFAULT_ALT_MAX),
    });
  }
  for (const p of filters.phases) {
    chips.push({ key: `phase-${p}`, label: p, clear: () => filters.setPhases(filters.phases.filter((x) => x !== p)) });
  }

  return (
    <div className="filter-drawer">
      <div className="filter-drawer__bar">
        <button
          className={`filter-toggle${active ? ' filter-toggle--active' : ''}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          ⊟ Filters{active && <span className="filter-badge">{chips.length}</span>}
        </button>

        {active && !open && (
          <div className="filter-chips">
            {chips.map((c) => (
              <button key={c.key} className="filter-chip" onClick={c.clear}>
                {c.label} ×
              </button>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className="filter-panel">
          <div className="filter-row">
            <label className="filter-field">
              <span>Callsign / Flight</span>
              <input
                type="text"
                value={filters.callsign}
                onChange={(e) => filters.setCallsign(e.target.value)}
                placeholder="e.g. UAL"
              />
            </label>
            <label className="filter-field">
              <span>Manufacturer</span>
              <input
                type="text"
                value={filters.manufacturer}
                onChange={(e) => filters.setManufacturer(e.target.value)}
                placeholder="e.g. Boeing"
              />
            </label>
            <label className="filter-field">
              <span>Model</span>
              <input
                type="text"
                value={filters.model}
                onChange={(e) => filters.setModel(e.target.value)}
                placeholder="e.g. B738"
              />
            </label>
          </div>

          <div className="filter-row">
            <label className="filter-field">
              <span>Min altitude (ft)</span>
              <input
                type="number"
                min={0}
                max={60000}
                step={500}
                value={filters.altMin}
                onChange={(e) => filters.setAltRange(Math.max(0, parseInt(e.target.value) || 0), filters.altMax)}
              />
            </label>
            <label className="filter-field">
              <span>Max altitude (ft)</span>
              <input
                type="number"
                min={0}
                max={60000}
                step={500}
                value={filters.altMax}
                onChange={(e) => filters.setAltRange(filters.altMin, Math.min(60000, parseInt(e.target.value) || 60000))}
              />
            </label>
          </div>

          <div className="filter-phases">
            <span className="filter-phases__label">Phase</span>
            {ALL_PHASES.map((p) => (
              <button
                key={p}
                className={`phase-toggle${filters.phases.includes(p) ? ' phase-toggle--active' : ''}`}
                onClick={() =>
                  filters.setPhases(
                    filters.phases.includes(p)
                      ? filters.phases.filter((x) => x !== p)
                      : [...filters.phases, p]
                  )
                }
              >
                {p}
              </button>
            ))}
          </div>

          {active && (
            <button className="filter-clear" onClick={filters.reset}>
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add FilterDrawer CSS**

Append the following to `src/index.css`:

```css
/* ── Filter Drawer ─────────────────────────────────────── */
.filter-drawer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 500;
  font-family: monospace;
}

.filter-drawer__bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--bg-modal, rgba(10, 11, 15, 0.88));
  border-top: 1px solid var(--border, #1f2937);
  flex-wrap: wrap;
}

.filter-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border, #374151);
  background: transparent;
  color: var(--text-muted, #9ca3af);
  font-family: monospace;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.filter-toggle--active {
  border-color: #7dd3fc;
  color: #7dd3fc;
}

.filter-badge {
  background: #ef4444;
  color: #fff;
  border-radius: 9999px;
  font-size: 10px;
  padding: 1px 5px;
  font-weight: bold;
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.filter-chip {
  padding: 2px 8px;
  border-radius: 9999px;
  border: 1px solid #374151;
  background: rgba(55, 65, 81, 0.4);
  color: #e5e7eb;
  font-family: monospace;
  font-size: 11px;
  cursor: pointer;
}

.filter-chip:hover {
  border-color: #ef4444;
  color: #ef4444;
}

.filter-panel {
  padding: 12px 14px;
  background: var(--bg-modal, rgba(10, 11, 15, 0.95));
  border-top: 1px solid var(--border, #1f2937);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.filter-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 11px;
  color: var(--text-muted, #9ca3af);
}

.filter-field input {
  background: var(--bg-input, #1f2937);
  border: 1px solid var(--border, #374151);
  border-radius: 4px;
  color: var(--text, #e5e7eb);
  font-family: monospace;
  font-size: 12px;
  padding: 4px 8px;
  width: 140px;
}

.filter-phases {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-phases__label {
  font-size: 11px;
  color: var(--text-muted, #9ca3af);
  margin-right: 2px;
}

.phase-toggle {
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid var(--border, #374151);
  background: transparent;
  color: var(--text-muted, #9ca3af);
  font-family: monospace;
  font-size: 11px;
  cursor: pointer;
}

.phase-toggle--active {
  background: rgba(125, 211, 252, 0.15);
  border-color: #7dd3fc;
  color: #7dd3fc;
}

.filter-clear {
  align-self: flex-start;
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid #ef444466;
  background: transparent;
  color: #ef4444;
  font-family: monospace;
  font-size: 12px;
  cursor: pointer;
}

.filter-clear:hover {
  background: rgba(239, 68, 68, 0.1);
}

.theme-light .filter-drawer__bar,
.theme-light .filter-panel {
  background: rgba(240, 242, 248, 0.96);
  border-color: #d1d5db;
}

.theme-light .filter-toggle {
  border-color: #9ca3af;
  color: #6b7280;
}

.theme-light .filter-toggle--active {
  border-color: #2563eb;
  color: #2563eb;
}

.theme-light .filter-field {
  color: #6b7280;
}

.theme-light .filter-field input {
  background: #fff;
  border-color: #d1d5db;
  color: #1f2937;
}

.theme-light .filter-chip {
  border-color: #d1d5db;
  background: rgba(209, 213, 219, 0.4);
  color: #374151;
}

.theme-light .phase-toggle {
  border-color: #d1d5db;
  color: #6b7280;
}

.theme-light .phase-toggle--active {
  background: rgba(37, 99, 235, 0.1);
  border-color: #2563eb;
  color: #2563eb;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/FilterDrawer/FilterDrawer.tsx src/index.css
git commit -m "feat: add FilterDrawer component and CSS"
```

---

## Task 9: Wire filters into MapView

**Files:**
- Modify: `src/components/MapView/MapView.tsx`

- [ ] **Step 1: Add filter imports and apply filter**

Replace the top of `src/components/MapView/MapView.tsx` (imports + component body, up to the `aircraft` array) with:

```tsx
// src/components/MapView/MapView.tsx
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useAircraftStore } from '../../store/aircraftStore';
import { useSettingsStore } from '../../hooks/useSettings';
import { useFilterStore } from '../../store/filterStore';
import { matchesFilter } from '../../lib/aircraftFilter';
import { aircraftColor } from '../../lib/colorSystem';
import { AircraftMarker } from './AircraftMarker';
import { AircraftOverlay } from './AircraftOverlay';
import { FlightPreview } from '../FlightBubble/FlightPreview';
import { FlightBubble } from '../FlightBubble/FlightBubble';
import { FilterDrawer } from '../FilterDrawer/FilterDrawer';
import { interpolatePosition } from '../../lib/interpolate';
```

Inside `MapView`, also destructure `theme` from the settings store (needed to compute bubble color). Then after the `aircraft` array is built (after the `interpolatePosition` map), add filter:

```tsx
const { lat, lng, tileSource, theme } = useSettingsStore();
// ...
const filters = useFilterStore();
const visibleAircraft = aircraft.filter((ac) => matchesFilter(ac, filters));
```

Then replace all uses of `aircraft` in the render with `visibleAircraft` — specifically the `.map((ac) => ...)` that renders `AircraftOverlay` + `AircraftMarker`.

- [ ] **Step 2: Add FilterDrawer to MapView render**

The `map-container` div already exists. Make sure it has `position: relative` in CSS (check `src/index.css` — if `.map-container` doesn't have it, add `position: relative;`). Then add `<FilterDrawer />` as the last child inside the outer `map-container` div:

```tsx
return (
  <div
    className="map-container"
    onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
  >
    <MapContainer
      center={[lat, lng]}
      zoom={8}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
    >
      <MapRecenter lat={lat} lng={lng} />
      <TileLayer
        url={tileSource === 'osm' ? OSM_TILES : SAT_TILES}
        attribution={tileSource === 'osm' ? OSM_ATTR : SAT_ATTR}
      />
      {visibleAircraft.map((ac) => (
        <React.Fragment key={ac.hex}>
          <AircraftOverlay aircraft={ac} />
          <AircraftMarker aircraft={ac} />
        </React.Fragment>
      ))}
    </MapContainer>

    {hoveredAircraft && hoverPos && !pinnedHexes.has(hoveredAircraft.hex) && (
      <FlightPreview aircraft={hoveredAircraft} x={hoverPos.x} y={hoverPos.y} />
    )}

    <div className="bubbles-container">
      {[...pinnedHexes].map((hex) => {
        const ac = aircraftMap.get(hex);
        if (!ac) return null;
        const color = aircraftColor(ac.t, theme);
        return <FlightBubble key={hex} aircraft={ac} color={color} />;
      })}
    </div>

    <FilterDrawer />
  </div>
);
```

- [ ] **Step 3: Ensure `.map-container` has `position: relative`**

In `src/index.css`, find `.map-container` and verify it has `position: relative`. If not, add it.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/MapView/MapView.tsx src/index.css
git commit -m "feat: wire aircraft filter into MapView"
```

---

## Task 10: Wire filters into RadarView

**Files:**
- Modify: `src/components/RadarView/RadarView.tsx`

- [ ] **Step 1: Add filter imports**

At the top of `src/components/RadarView/RadarView.tsx`, add:

```typescript
import { useFilterStore } from '../../store/filterStore';
import { matchesFilter } from '../../lib/aircraftFilter';
import { FilterDrawer } from '../FilterDrawer/FilterDrawer';
```

- [ ] **Step 2: Filter aircraft in the RAF loop**

Inside the `loop` function in the RAF `useEffect`, filter aircraft before passing to `drawRadar`:

```typescript
const loop = () => {
  const now = Date.now();
  const allAircraft = Array.from(aircraftMap.values()).map((ac) =>
    interpolatePosition(ac, now)
  );
  const aircraft = allAircraft.filter((ac) => matchesFilter(ac, filtersRef.current));
  const effectiveRadius = radiusKmRef.current / zoomLevelRef.current;
  drawRadar({
    // ...
    aircraft,
    // ...
  });
  rafRef.current = requestAnimationFrame(loop);
};
```

Add a ref for filters (so the RAF loop reads current filters without being a dependency):

```typescript
const filters = useFilterStore();
const filtersRef = useRef(filters);
useEffect(() => { filtersRef.current = filters; }, [filters]);
```

- [ ] **Step 3: Filter in `hitTest`**

`hitTest` iterates `aircraftMap.values()`. It must skip filtered-out aircraft. Update the `hitTest` callback:

```typescript
const hitTest = useCallback(
  (clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left - panOffsetRef.current.x;
    const my = clientY - rect.top - panOffsetRef.current.y;
    const effectiveRadius = radiusKmRef.current / zoomLevelRef.current;

    for (const ac of aircraftMap.values()) {
      if (!matchesFilter(ac, filtersRef.current)) continue;   // NEW
      const pos = latLonToCanvas(
        ac._renderLat, ac._renderLon,
        latRef.current, lngRef.current, effectiveRadius,
        canvas.width, canvas.height
      );
      if (Math.hypot(mx - pos.x, my - pos.y) < 18) return ac.hex;
    }
    return null;
  },
  [aircraftMap]
);
```

- [ ] **Step 4: Add FilterDrawer to RadarView render**

Ensure `.radar-container` has `position: relative` in `src/index.css`. Then add `<FilterDrawer />` as the last child in the returned `radar-container` div:

```tsx
return (
  <div className="radar-container">
    <canvas
      ref={canvasRef}
      // ... all existing event handlers ...
    />

    {hoveredAircraft && hoverPos && !pinnedHexes.has(hoveredAircraft.hex) && (
      <FlightPreview aircraft={hoveredAircraft} x={hoverPos.x} y={hoverPos.y} />
    )}

    <div className="bubbles-container">
      {[...pinnedHexes].map((hex) => {
        const ac = aircraftMap.get(hex);
        if (!ac) return null;
        const color = aircraftColor(ac.t, theme);
        return <FlightBubble key={hex} aircraft={ac} color={color} />;
      })}
    </div>

    <FilterDrawer />
  </div>
);
```

- [ ] **Step 5: Verify TypeScript compiles and all tests pass**

```bash
npx tsc --noEmit && npm test
```

Expected: no type errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/RadarView/RadarView.tsx src/index.css
git commit -m "feat: wire aircraft filter into RadarView and hitTest"
```
