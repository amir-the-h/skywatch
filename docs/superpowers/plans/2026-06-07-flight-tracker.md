# Flight Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal flight tracking web app that fetches live ADS-B data from airplanes.live and renders aircraft as neon silhouettes on an interactive Leaflet map and a Canvas radar scope.

**Architecture:** Data flows from a polling hook → Zustand store → two interchangeable views (Leaflet map + Canvas radar). Aircraft are color-coded by a deterministic hash of manufacturer+type and rendered as SVG silhouettes. Position is interpolated between polls using dead reckoning. All settings are persisted to localStorage.

**Tech Stack:** React 19, TypeScript, Vite, Zustand, React-Leaflet v5, Leaflet, HTML Canvas, Vitest + Testing Library, jsdom

---

## File Map

```
src/
├── types/
│   └── aircraft.ts           # Aircraft, Settings, AircraftFamily types
├── lib/
│   ├── colorSystem.ts        # djb2 hash → HSL color by manufacturer/type
│   ├── silhouettes.ts        # SVG path data per AircraftFamily + family classifier
│   ├── geoUtils.ts           # haversine, bounding box, lat/lon→canvas px
│   └── interpolate.ts        # dead-reckoning position step
├── hooks/
│   ├── useSettings.ts        # localStorage-backed settings (Zustand slice)
│   └── useAircraftFeed.ts    # polling loop → store merge
├── store/
│   └── aircraftStore.ts      # Zustand — Map<hex, Aircraft>, pinnedHexes, hoveredHex
├── api/
│   └── airplanesLive.ts      # fetch + normalize airplanes.live /v2/point response
├── components/
│   ├── SettingsPanel/
│   │   └── SettingsModal.tsx  # settings modal overlay
│   ├── FlightBubble/
│   │   ├── FlightPreview.tsx  # hover tooltip
│   │   └── FlightBubble.tsx   # pinned full-info card
│   ├── MapView/
│   │   ├── AircraftMarker.tsx # SVG DivIcon, rotated to heading
│   │   └── MapView.tsx        # React-Leaflet map + all markers
│   └── RadarView/
│       ├── RadarCanvas.ts     # pure draw functions (rings, grid, aircraft)
│       └── RadarView.tsx      # canvas container + rAF loop
└── App.tsx                    # root — floating controls, view switcher, modal state
    index.css                  # global reset + CSS custom properties + theme classes
```

**Tests live beside their source:**
- `src/lib/colorSystem.test.ts`
- `src/lib/geoUtils.test.ts`
- `src/lib/interpolate.test.ts`
- `src/hooks/useSettings.test.ts`
- `src/api/airplanesLive.test.ts`

---

## Task 1: Types and Settings Defaults

**Files:**
- Create: `src/types/aircraft.ts`

- [ ] **Step 1: Create the types file**

```ts
// src/types/aircraft.ts

export type AircraftFamily =
  | 'narrowbody-short'
  | 'narrowbody-long'
  | 'widebody-medium'
  | 'widebody-large'
  | 'very-large'
  | 'regional-small'
  | 'regional-medium'
  | 'regional-large'
  | 'turboprop'
  | 'bizjet-small'
  | 'bizjet-large'
  | 'military'
  | 'generic';

export interface Aircraft {
  hex: string;
  flight: string;           // callsign
  r: string;                // registration
  t: string;                // ICAO type code e.g. "B738"
  lat: number;
  lon: number;
  alt_baro: number;         // feet
  gs: number;               // ground speed kts
  track: number;            // true track degrees (0 = north)
  baro_rate: number;        // ft/min
  mach?: number;
  squawk?: string;
  emergency?: string;
  nav_altitude_mcp?: number;
  nav_heading?: number;
  nav_modes?: string[];
  ownOp?: string;
  year?: string;
  seen: number;             // seconds since last message
  // client-side interpolation state
  _renderLat: number;
  _renderLon: number;
  _lastSeen: number;        // Date.now() timestamp when record was merged
}

export interface Settings {
  lat: number;
  lng: number;
  radiusKm: number;
  refreshInterval: number;  // seconds
  theme: 'dark' | 'light';
  tileSource: 'osm' | 'satellite';
  view: 'map' | 'radar';
  ringIntervals: number[];  // km, for radar view
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
};
```

- [ ] **Step 2: Commit**

```bash
git add src/types/aircraft.ts
git commit -m "feat: add Aircraft, Settings types and defaults"
```

---

## Task 2: Color System

**Files:**
- Create: `src/lib/colorSystem.ts`
- Create: `src/lib/colorSystem.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/colorSystem.test.ts
import { describe, it, expect } from 'vitest';
import { aircraftColor, getManufacturer } from './colorSystem';

describe('getManufacturer', () => {
  it('maps Boeing type codes', () => {
    expect(getManufacturer('B738')).toBe('Boeing');
    expect(getManufacturer('B77W')).toBe('Boeing');
  });

  it('maps Airbus type codes', () => {
    expect(getManufacturer('A320')).toBe('Airbus');
    expect(getManufacturer('A350')).toBe('Airbus');
  });

  it('maps Bombardier CRJ codes', () => {
    expect(getManufacturer('CRJ9')).toBe('Bombardier');
  });

  it('falls back to first 3 chars for unknown types', () => {
    expect(getManufacturer('XYZ1')).toBe('XYZ');
  });
});

describe('aircraftColor', () => {
  it('returns a valid hsl string', () => {
    const color = aircraftColor('B738', 'dark');
    expect(color).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/);
  });

  it('is deterministic — same type gives same color', () => {
    expect(aircraftColor('A320', 'dark')).toBe(aircraftColor('A320', 'dark'));
  });

  it('same manufacturer → same hue family', () => {
    // B738 and B77W are both Boeing — parse hue to confirm they match
    const hue = (color: string) => parseInt(color.match(/hsl\((\d+)/)![1]);
    expect(hue(aircraftColor('B738', 'dark'))).toBe(hue(aircraftColor('B77W', 'dark')));
  });

  it('dark theme uses higher lightness than light theme', () => {
    const lightness = (color: string) => parseInt(color.match(/(\d+)%\)$/)![1]);
    expect(lightness(aircraftColor('A320', 'dark'))).toBeGreaterThan(
      lightness(aircraftColor('A320', 'light'))
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/colorSystem.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement colorSystem.ts**

```ts
// src/lib/colorSystem.ts

const MANUFACTURER_PREFIXES: [string, string][] = [
  ['B7', 'Boeing'],
  ['B74', 'Boeing'],
  ['B75', 'Boeing'],
  ['B76', 'Boeing'],
  ['B77', 'Boeing'],
  ['B78', 'Boeing'],
  ['A3', 'Airbus'],
  ['A2', 'Airbus'],
  ['CRJ', 'Bombardier'],
  ['BD7', 'Bombardier'],
  ['E1', 'Embraer'],
  ['E17', 'Embraer'],
  ['E19', 'Embraer'],
  ['E29', 'Embraer'],
  ['ERJ', 'Embraer'],
  ['DH', 'De Havilland'],
  ['AT4', 'ATR'],
  ['AT7', 'ATR'],
  ['GLF', 'Gulfstream'],
  ['GL5', 'Gulfstream'],
  ['GL6', 'Gulfstream'],
  ['GL7', 'Gulfstream'],
  ['C17', 'Boeing'],
  ['C25', 'Cessna'],
  ['C5', 'Cessna'],
  ['C68', 'Cessna'],
  ['LJ', 'Learjet'],
  ['F9', 'Dassault'],
  ['F2T', 'Dassault'],
  ['MD', 'McDonnell Douglas'],
  ['DC', 'McDonnell Douglas'],
];

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getManufacturer(typeCode: string): string {
  const t = typeCode.toUpperCase();
  for (const [prefix, name] of MANUFACTURER_PREFIXES) {
    if (t.startsWith(prefix)) return name;
  }
  return t.slice(0, 3);
}

export function aircraftColor(typeCode: string, theme: 'dark' | 'light'): string {
  const manufacturer = getManufacturer(typeCode);
  const hue = djb2(manufacturer) % 360;
  const lightnessBase = theme === 'dark' ? 55 : 35;
  const lightness = lightnessBase + (djb2(typeCode + 'L') % 25);
  const saturation = 90 + (djb2(typeCode + 'S') % 10);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/colorSystem.test.ts
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/colorSystem.ts src/lib/colorSystem.test.ts
git commit -m "feat: add deterministic aircraft color system"
```

---

## Task 3: Silhouettes

**Files:**
- Create: `src/lib/silhouettes.ts`

No unit tests needed — the paths are static data; correctness is visual.

- [ ] **Step 1: Create silhouettes.ts**

```ts
// src/lib/silhouettes.ts
import type { AircraftFamily } from '../types/aircraft';

// All paths use viewBox="-50 -100 100 200"
// Nose points up (-Y). Aircraft is outline-only (stroke, no fill).
// Scale/rotate at render time.
export const SILHOUETTE_PATHS: Record<AircraftFamily, string> = {
  // A319, A320, B737-700/800
  'narrowbody-short': `M 0,-85 C 3,-82 5,-58 5,-10 L 44,22 42,33 7,15 7,65 17,72 16,80 0,76 -16,80 -17,72 -7,65 -7,15 -42,33 -44,22 -5,-10 C -5,-58 -3,-82 0,-85 Z`,

  // A321, B737-900, B757
  'narrowbody-long': `M 0,-92 C 3,-88 4,-60 4,-10 L 43,22 41,33 6,15 6,74 16,81 15,89 0,85 -15,89 -16,81 -6,74 -6,15 -41,33 -43,22 -4,-10 C -4,-60 -3,-88 0,-92 Z`,

  // A330, B767, B787-8
  'widebody-medium': `M 0,-84 C 7,-78 9,-52 9,-5 L 53,28 50,40 11,18 11,65 22,73 20,82 0,78 -20,82 -22,73 -11,65 -11,18 -50,40 -53,28 -9,-5 C -9,-52 -7,-78 0,-84 Z`,

  // A350, B777, B787-10
  'widebody-large': `M 0,-84 C 9,-78 11,-52 11,-5 L 57,30 54,44 13,18 13,65 26,73 24,82 0,78 -24,82 -26,73 -13,65 -13,18 -54,44 -57,30 -11,-5 C -11,-52 -9,-78 0,-84 Z`,

  // A380, B747
  'very-large': `M 0,-84 C 12,-77 14,-50 14,-5 L 62,32 58,48 16,20 16,65 30,73 28,82 0,78 -28,82 -30,73 -16,65 -16,20 -58,48 -62,32 -14,-5 C -14,-50 -12,-77 0,-84 Z`,

  // CRJ200, ERJ145
  'regional-small': `M 0,-78 C 2,-75 3,-52 3,-15 L 30,12 29,20 5,8 5,55 13,62 12,70 0,66 -12,70 -13,62 -5,55 -5,8 -29,20 -30,12 -3,-15 C -3,-52 -2,-75 0,-78 Z`,

  // CRJ700/900, E170/175
  'regional-medium': `M 0,-80 C 3,-76 4,-52 4,-12 L 36,18 34,28 6,10 6,58 15,66 14,74 0,70 -14,74 -15,66 -6,58 -6,10 -34,28 -36,18 -4,-12 C -4,-52 -3,-76 0,-80 Z`,

  // E190/195
  'regional-large': `M 0,-82 C 3,-78 5,-53 5,-10 L 40,20 38,30 7,13 7,63 17,71 16,79 0,75 -16,79 -17,71 -7,63 -7,13 -38,30 -40,20 -5,-10 C -5,-53 -3,-78 0,-82 Z`,

  // ATR42/72, Q400
  'turboprop': `M 0,-70 C 3,-67 4,-46 4,-10 L 38,8 36,18 7,6 7,58 15,65 14,73 0,69 -14,73 -15,65 -7,58 -7,6 -36,18 -38,8 -4,-10 C -4,-46 -3,-67 0,-70 Z`,

  // Citation, Phenom
  'bizjet-small': `M 0,-82 C 2,-78 3,-52 3,-10 L 34,26 31,34 5,10 5,60 12,68 11,76 0,72 -11,76 -12,68 -5,60 -5,10 -31,34 -34,26 -3,-10 C -3,-52 -2,-78 0,-82 Z`,

  // Gulfstream, Global
  'bizjet-large': `M 0,-85 C 3,-80 5,-53 5,-8 L 46,28 43,38 7,12 7,64 18,72 17,80 0,76 -17,80 -18,72 -7,64 -7,12 -43,38 -46,28 -5,-8 C -5,-53 -3,-80 0,-85 Z`,

  // Generic delta/fighter silhouette
  'military': `M 0,-85 L 5,-72 L 47,55 L 20,46 L 9,78 L 0,82 L -9,78 L -20,46 L -47,55 L -5,-72 Z`,

  // Fallback
  'generic': `M 0,-80 C 4,-75 5,-47 5,-10 L 38,22 37,32 7,14 7,63 16,70 15,78 0,74 -15,78 -16,70 -7,63 -7,14 -37,32 -38,22 -5,-10 C -5,-47 -4,-75 0,-80 Z`,
};

export function getAircraftFamily(typeCode: string): AircraftFamily {
  if (!typeCode) return 'generic';
  const t = typeCode.toUpperCase();

  if (/^(A38[02]|B74[278S]|AN12[45])/.test(t)) return 'very-large';
  if (/^(A35[09X]|B77[7-9LWF]|B78X|IL96)/.test(t)) return 'widebody-large';
  if (/^(A33[09]|A34[05]|B76[2-9]|B78[789]|DC10|MD11|L101)/.test(t)) return 'widebody-medium';
  if (/^(A321|B735|B739|B75[27]|MD8[02])/.test(t)) return 'narrowbody-long';
  if (/^(A31[89]|A32[02N]|B73[0-8]|B73M|MD8[0-9])/.test(t)) return 'narrowbody-short';
  if (/^(E19[05]|E290|E295|ERJ19[05])/.test(t)) return 'regional-large';
  if (/^(CRJ7|CRJ9|E170|E175|E17[05]|ERJ17[05])/.test(t)) return 'regional-medium';
  if (/^(CRJ[12]|CRJ2|E135|E145|ERJ13[45]|ERJ14[05])/.test(t)) return 'regional-small';
  if (/^(AT[47][27]|DH8[ABCD0-4]|Q[34]00|SF34|E120|BE19|BE20|SW4|PC12|TBM|PAY)/.test(t)) return 'turboprop';
  if (/^(GL[56789]|GV|G[456]|GLF[456]|F9[0X]|F2TH|CL6[05]|CL30|BD700)/.test(t)) return 'bizjet-large';
  if (/^(C25[0-9A-Z]|C5[0-9]|C68[0-9]|LJ[2-7][0-9]|BE40|FA[27]0|PC24|E50[0-9])/.test(t)) return 'bizjet-small';
  if (/^(F1[456789]|F22|F35|B2B|AV8|A10|C130|C17|MQ9|U2)/.test(t)) return 'military';

  return 'generic';
}

export const SILHOUETTE_VIEWBOX = '-50 -100 100 200';
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/silhouettes.ts
git commit -m "feat: add aircraft silhouette SVG paths and family classifier"
```

---

## Task 4: Geo Utils

**Files:**
- Create: `src/lib/geoUtils.ts`
- Create: `src/lib/geoUtils.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/geoUtils.test.ts
import { describe, it, expect } from 'vitest';
import { haversineKm, boundingBox, latLonToCanvas } from './geoUtils';

describe('haversineKm', () => {
  it('returns ~0 for same point', () => {
    expect(haversineKm(41, 28, 41, 28)).toBeCloseTo(0, 5);
  });

  it('returns ~111 km per degree of latitude', () => {
    expect(haversineKm(0, 0, 1, 0)).toBeCloseTo(111.2, 0);
  });

  it('is symmetric', () => {
    const d1 = haversineKm(41, 28, 42, 29);
    const d2 = haversineKm(42, 29, 41, 28);
    expect(d1).toBeCloseTo(d2, 5);
  });
});

describe('boundingBox', () => {
  it('returns a box with correct structure', () => {
    const box = boundingBox(41, 28, 100);
    expect(box).toHaveProperty('minLat');
    expect(box).toHaveProperty('maxLat');
    expect(box).toHaveProperty('minLon');
    expect(box).toHaveProperty('maxLon');
  });

  it('produces a box wider than tall near the equator', () => {
    // At equator lng degrees == km, at lat 0 it should be symmetric
    const box = boundingBox(0, 0, 100);
    expect(box.maxLat - box.minLat).toBeCloseTo(box.maxLon - box.minLon, 0);
  });

  it('produces a wider box in km at higher latitude', () => {
    // At higher latitudes, the box in degrees is wider for the same km radius
    const boxAt60 = boundingBox(60, 0, 100);
    const boxAt0 = boundingBox(0, 0, 100);
    expect(boxAt60.maxLon - boxAt60.minLon).toBeGreaterThan(boxAt0.maxLon - boxAt0.minLon);
  });
});

describe('latLonToCanvas', () => {
  it('maps center point to canvas center', () => {
    const result = latLonToCanvas(41, 28, 41, 28, 100, 800, 800);
    expect(result.x).toBeCloseTo(400, 1);
    expect(result.y).toBeCloseTo(400, 1);
  });

  it('maps a north point above center (lower y)', () => {
    // North = higher lat = lower Y on canvas
    const center = latLonToCanvas(41, 28, 41, 28, 100, 800, 800);
    const north = latLonToCanvas(42, 28, 41, 28, 100, 800, 800);
    expect(north.y).toBeLessThan(center.y);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/geoUtils.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement geoUtils.ts**

```ts
// src/lib/geoUtils.ts

const R_KM = 6371;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function boundingBox(
  lat: number,
  lon: number,
  radiusKm: number
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const latDelta = radiusKm / 111.0;
  const lonDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta,
  };
}

export function latLonToCanvas(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
  radiusKm: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const scale = Math.min(canvasWidth, canvasHeight) / 2 / radiusKm;
  // Approximate dx/dy in km using haversine projected onto each axis
  const dxKm = haversineKm(centerLat, centerLon, centerLat, lon) * (lon >= centerLon ? 1 : -1);
  const dyKm = haversineKm(centerLat, centerLon, lat, centerLon) * (lat >= centerLat ? 1 : -1);
  return {
    x: canvasWidth / 2 + dxKm * scale,
    y: canvasHeight / 2 - dyKm * scale, // canvas Y increases downward
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/geoUtils.test.ts
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/geoUtils.ts src/lib/geoUtils.test.ts
git commit -m "feat: add haversine distance, bounding box, and lat/lon→canvas utils"
```

---

## Task 5: Position Interpolation

**Files:**
- Create: `src/lib/interpolate.ts`
- Create: `src/lib/interpolate.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/interpolate.test.ts
import { describe, it, expect } from 'vitest';
import { interpolatePosition } from './interpolate';
import type { Aircraft } from '../types/aircraft';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return {
    hex: 'abc123',
    flight: 'TST1',
    r: 'N123AB',
    t: 'B738',
    lat: 41.0,
    lon: 28.0,
    alt_baro: 35000,
    gs: 450,            // kts
    track: 90,          // due east
    baro_rate: 0,
    seen: 0,
    _renderLat: 41.0,
    _renderLon: 28.0,
    _lastSeen: 1000,    // 1 second ago
    ...overrides,
  };
}

describe('interpolatePosition', () => {
  it('does not move aircraft with 0 ground speed', () => {
    const ac = makeAircraft({ gs: 0 });
    const result = interpolatePosition(ac, 2000);
    expect(result._renderLat).toBeCloseTo(41.0, 5);
    expect(result._renderLon).toBeCloseTo(28.0, 5);
  });

  it('moves aircraft eastward when heading is 90°', () => {
    const ac = makeAircraft({ track: 90, gs: 450 });
    const result = interpolatePosition(ac, 2000); // 1 second elapsed
    expect(result._renderLon).toBeGreaterThan(28.0);
    expect(result._renderLat).toBeCloseTo(41.0, 3);
  });

  it('caps interpolation at 10 seconds', () => {
    const ac = makeAircraft({ track: 0, gs: 450 });
    const result10 = interpolatePosition(ac, 11000); // 10s elapsed
    const result20 = interpolatePosition(ac, 21000); // 20s elapsed — capped at 10s
    expect(result10._renderLat).toBeCloseTo(result20._renderLat, 5);
  });

  it('does not move if elapsed time is negative', () => {
    const ac = makeAircraft({ track: 90, gs: 450 });
    const result = interpolatePosition(ac, 500); // _lastSeen=1000, so -500ms
    expect(result._renderLat).toBeCloseTo(41.0, 5);
    expect(result._renderLon).toBeCloseTo(28.0, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/interpolate.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement interpolate.ts**

Dead-reckoning: advance position using heading and ground speed. Ground speed in knots, 1 knot = 1.852 km/h.

```ts
// src/lib/interpolate.ts
import type { Aircraft } from '../types/aircraft';

const MAX_INTERPOLATE_MS = 10_000;
const KTS_TO_KM_PER_MS = 1.852 / 3_600_000; // knots → km/ms
const R_KM = 6371;

export function interpolatePosition(ac: Aircraft, nowMs: number): Aircraft {
  const elapsedMs = Math.min(Math.max(nowMs - ac._lastSeen, 0), MAX_INTERPOLATE_MS);
  if (elapsedMs === 0 || ac.gs === 0) return ac;

  const distKm = ac.gs * KTS_TO_KM_PER_MS * elapsedMs;
  const bearingRad = (ac.track * Math.PI) / 180;

  const latRad = (ac._renderLat * Math.PI) / 180;
  const lonRad = (ac._renderLon * Math.PI) / 180;
  const d = distKm / R_KM;

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(d) + Math.cos(latRad) * Math.sin(d) * Math.cos(bearingRad)
  );
  const newLonRad =
    lonRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(d) * Math.cos(latRad),
      Math.cos(d) - Math.sin(latRad) * Math.sin(newLatRad)
    );

  return {
    ...ac,
    _renderLat: (newLatRad * 180) / Math.PI,
    _renderLon: (newLonRad * 180) / Math.PI,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/interpolate.test.ts
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/interpolate.ts src/lib/interpolate.test.ts
git commit -m "feat: add dead-reckoning position interpolation"
```

---

## Task 6: Settings Hook

**Files:**
- Create: `src/hooks/useSettings.ts`
- Create: `src/hooks/useSettings.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/hooks/useSettings.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettingsStore } from './useSettings';
import { DEFAULT_SETTINGS } from '../types/aircraft';

beforeEach(() => {
  localStorage.clear();
  useSettingsStore.setState(DEFAULT_SETTINGS);
});

describe('useSettings', () => {
  it('initializes with DEFAULT_SETTINGS', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.lat).toBe(DEFAULT_SETTINGS.lat);
    expect(result.current.theme).toBe('dark');
  });

  it('updates a single setting', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => result.current.update({ theme: 'light' }));
    expect(result.current.theme).toBe('light');
  });

  it('persists updated setting to localStorage', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => result.current.update({ lat: 51.5 }));
    const stored = JSON.parse(localStorage.getItem('ft-settings')!);
    expect(stored.lat).toBe(51.5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/hooks/useSettings.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement useSettings.ts**

```ts
// src/hooks/useSettings.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '../types/aircraft';
import { DEFAULT_SETTINGS } from '../types/aircraft';

interface SettingsStore extends Settings {
  update: (patch: Partial<Settings>) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set((s) => ({ ...s, ...patch })),
    }),
    { name: 'ft-settings' }
  )
);
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/hooks/useSettings.test.ts
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSettings.ts src/hooks/useSettings.test.ts
git commit -m "feat: add localStorage-persisted settings store"
```

---

## Task 7: Aircraft Store

**Files:**
- Create: `src/store/aircraftStore.ts`

No unit tests — Zustand store behavior is covered via integration in hook tests.

- [ ] **Step 1: Create the store**

```ts
// src/store/aircraftStore.ts
import { create } from 'zustand';
import type { Aircraft } from '../types/aircraft';

interface AircraftStore {
  aircraft: Map<string, Aircraft>;
  pinnedHexes: Set<string>;
  hoveredHex: string | null;
  lastUpdated: number | null;

  mergeAircraft: (incoming: Aircraft[]) => void;
  removeStale: (hexes: Set<string>) => void;
  pin: (hex: string) => void;
  unpin: (hex: string) => void;
  setHovered: (hex: string | null) => void;
}

export const useAircraftStore = create<AircraftStore>((set) => ({
  aircraft: new Map(),
  pinnedHexes: new Set(),
  hoveredHex: null,
  lastUpdated: null,

  mergeAircraft: (incoming) =>
    set((state) => {
      const next = new Map(state.aircraft);
      const now = Date.now();
      for (const ac of incoming) {
        const prev = next.get(ac.hex);
        next.set(ac.hex, {
          ...ac,
          _renderLat: prev ? prev._renderLat : ac.lat,
          _renderLon: prev ? prev._renderLon : ac.lon,
          _lastSeen: now,
        });
      }
      return { aircraft: next, lastUpdated: now };
    }),

  removeStale: (activeHexes) =>
    set((state) => {
      const next = new Map(state.aircraft);
      for (const hex of next.keys()) {
        if (!activeHexes.has(hex)) next.delete(hex);
      }
      // Also unpin removed aircraft
      const newPinned = new Set([...state.pinnedHexes].filter((h) => next.has(h)));
      return { aircraft: next, pinnedHexes: newPinned };
    }),

  pin: (hex) =>
    set((s) => ({ pinnedHexes: new Set([...s.pinnedHexes, hex]) })),

  unpin: (hex) =>
    set((s) => {
      const next = new Set(s.pinnedHexes);
      next.delete(hex);
      return { pinnedHexes: next };
    }),

  setHovered: (hex) => set({ hoveredHex: hex }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/store/aircraftStore.ts
git commit -m "feat: add Zustand aircraft store with merge and stale-removal"
```

---

## Task 8: API Layer

**Files:**
- Create: `src/api/airplanesLive.ts`
- Create: `src/api/airplanesLive.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/api/airplanesLive.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAircraft } from './airplanesLive';

const MOCK_RESPONSE = {
  ac: [
    {
      hex: 'abc123',
      flight: 'TK1 ',    // note trailing space — should be trimmed
      r: 'TC-JSM',
      t: 'B738',
      lat: 41.0,
      lon: 28.0,
      alt_baro: 35000,
      gs: 450,
      track: 180,
      baro_rate: -500,
      squawk: '1234',
      seen: 2,
    },
    {
      // missing lat/lon — should be filtered out
      hex: 'bad000',
      flight: 'XX9',
      t: 'A320',
      seen: 1,
    },
  ],
  total: 2,
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_RESPONSE,
    })
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchAircraft', () => {
  it('calls the correct URL with NM radius', async () => {
    await fetchAircraft(41, 28, 100);
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    // 100 km → ~54 NM
    expect(url).toMatch(/\/v2\/point\/41\/28\/\d+/);
  });

  it('normalizes and returns valid aircraft', async () => {
    const result = await fetchAircraft(41, 28, 100);
    expect(result).toHaveLength(1); // bad000 filtered out (no lat/lon)
    expect(result[0].hex).toBe('abc123');
    expect(result[0].flight).toBe('TK1'); // trimmed
  });

  it('initializes _renderLat/_renderLon to lat/lon', async () => {
    const result = await fetchAircraft(41, 28, 100);
    expect(result[0]._renderLat).toBe(41.0);
    expect(result[0]._renderLon).toBe(28.0);
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) })
    );
    await expect(fetchAircraft(41, 28, 100)).rejects.toThrow('429');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/api/airplanesLive.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement airplanesLive.ts**

```ts
// src/api/airplanesLive.ts
import type { Aircraft } from '../types/aircraft';

const BASE = 'https://api.airplanes.live/v2/point';
const KM_TO_NM = 0.539957;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(raw: any): Aircraft | null {
  if (raw.lat == null || raw.lon == null) return null;
  return {
    hex: raw.hex ?? '',
    flight: (raw.flight ?? '').trim(),
    r: raw.r ?? '',
    t: raw.t ?? '',
    lat: raw.lat,
    lon: raw.lon,
    alt_baro: raw.alt_baro ?? 0,
    gs: raw.gs ?? 0,
    track: raw.track ?? 0,
    baro_rate: raw.baro_rate ?? 0,
    mach: raw.mach,
    squawk: raw.squawk,
    emergency: raw.emergency,
    nav_altitude_mcp: raw.nav_altitude_mcp,
    nav_heading: raw.nav_heading,
    nav_modes: raw.nav_modes,
    ownOp: raw.ownOp,
    year: raw.year,
    seen: raw.seen ?? 0,
    _renderLat: raw.lat,
    _renderLon: raw.lon,
    _lastSeen: 0, // will be overwritten by store.mergeAircraft
  };
}

export async function fetchAircraft(
  lat: number,
  lon: number,
  radiusKm: number
): Promise<Aircraft[]> {
  const radiusNm = Math.round(radiusKm * KM_TO_NM);
  const url = `${BASE}/${lat}/${lon}/${radiusNm}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`airplanes.live ${res.status}`);
  const data = await res.json();
  return (data.ac ?? []).map(normalize).filter(Boolean) as Aircraft[];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/api/airplanesLive.test.ts
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/airplanesLive.ts src/api/airplanesLive.test.ts
git commit -m "feat: add airplanes.live API client with normalization"
```

---

## Task 9: Aircraft Feed Hook

**Files:**
- Create: `src/hooks/useAircraftFeed.ts`

- [ ] **Step 1: Implement useAircraftFeed.ts**

```ts
// src/hooks/useAircraftFeed.ts
import { useEffect, useRef } from 'react';
import { fetchAircraft } from '../api/airplanesLive';
import { useAircraftStore } from '../store/aircraftStore';
import { useSettingsStore } from './useSettings';

export function useAircraftFeed() {
  const { lat, lng, radiusKm, refreshInterval } = useSettingsStore();
  const { mergeAircraft, removeStale } = useAircraftStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const aircraft = await fetchAircraft(lat, lng, radiusKm);
        if (cancelled) return;
        mergeAircraft(aircraft);
        const activeHexes = new Set(aircraft.map((a) => a.hex));
        removeStale(activeHexes);
      } catch {
        // silently ignore — stale data stays visible
      }
    };

    poll();
    timerRef.current = setInterval(poll, refreshInterval * 1000);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lat, lng, radiusKm, refreshInterval, mergeAircraft, removeStale]);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useAircraftFeed.ts
git commit -m "feat: add polling feed hook"
```

---

## Task 10: Settings Modal

**Files:**
- Create: `src/components/SettingsPanel/SettingsModal.tsx`

- [ ] **Step 1: Create SettingsModal.tsx**

```tsx
// src/components/SettingsPanel/SettingsModal.tsx
import { useSettingsStore } from '../../hooks/useSettings';

interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
  const settings = useSettingsStore();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          <label>
            Latitude
            <input
              type="number"
              step="0.0001"
              value={settings.lat}
              onChange={(e) => settings.update({ lat: parseFloat(e.target.value) })}
            />
          </label>

          <label>
            Longitude
            <input
              type="number"
              step="0.0001"
              value={settings.lng}
              onChange={(e) => settings.update({ lng: parseFloat(e.target.value) })}
            />
          </label>

          <label>
            Radius (km)
            <input
              type="number"
              min={10}
              max={500}
              value={settings.radiusKm}
              onChange={(e) => settings.update({ radiusKm: parseInt(e.target.value) })}
            />
          </label>

          <label>
            Refresh interval (seconds)
            <input
              type="range"
              min={1}
              max={30}
              value={settings.refreshInterval}
              onChange={(e) => settings.update({ refreshInterval: parseInt(e.target.value) })}
            />
            <span>{settings.refreshInterval}s</span>
          </label>

          <label>
            Theme
            <select
              value={settings.theme}
              onChange={(e) =>
                settings.update({ theme: e.target.value as 'dark' | 'light' })
              }
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>

          <label>
            Radar rings (comma-separated km)
            <input
              type="text"
              value={settings.ringIntervals.join(', ')}
              onChange={(e) =>
                settings.update({
                  ringIntervals: e.target.value
                    .split(',')
                    .map((v) => parseInt(v.trim()))
                    .filter((v) => !isNaN(v) && v > 0),
                })
              }
            />
          </label>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SettingsPanel/SettingsModal.tsx
git commit -m "feat: add settings modal"
```

---

## Task 11: Flight Bubble Components

**Files:**
- Create: `src/components/FlightBubble/FlightPreview.tsx`
- Create: `src/components/FlightBubble/FlightBubble.tsx`

- [ ] **Step 1: Create FlightPreview.tsx (hover tooltip)**

```tsx
// src/components/FlightBubble/FlightPreview.tsx
import type { Aircraft } from '../../types/aircraft';

interface Props {
  aircraft: Aircraft;
  x: number;  // viewport px
  y: number;
}

export function FlightPreview({ aircraft, x, y }: Props) {
  return (
    <div
      className="flight-preview"
      style={{ left: x + 12, top: y - 8 }}
    >
      <div className="fp-callsign">{aircraft.flight || aircraft.hex}</div>
      <div className="fp-type">{aircraft.t}</div>
      <div className="fp-data">
        {aircraft.alt_baro.toLocaleString()} ft · {Math.round(aircraft.gs)} kts
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create FlightBubble.tsx (pinned full-info card)**

```tsx
// src/components/FlightBubble/FlightBubble.tsx
import { useState } from 'react';
import type { Aircraft } from '../../types/aircraft';
import { useAircraftStore } from '../../store/aircraftStore';

const EMERGENCY_LABELS: Record<string, string> = {
  '7700': 'General Emergency',
  'general': 'General Emergency',
  '7600': 'Radio Failure (NORDO)',
  'nordo': 'Radio Failure (NORDO)',
  '7500': 'Hijacking',
  'unlawful': 'Hijacking',
  'lifeguard': 'Medical Emergency',
  'minfuel': 'Minimum Fuel',
  'downed': 'Downed Aircraft',
};

function getEmergencyLabel(aircraft: Aircraft): string | null {
  const sq = aircraft.squawk ?? '';
  const em = aircraft.emergency ?? '';
  return EMERGENCY_LABELS[sq] ?? EMERGENCY_LABELS[em] ?? null;
}

interface Props {
  aircraft: Aircraft;
}

export function FlightBubble({ aircraft }: Props) {
  const unpin = useAircraftStore((s) => s.unpin);
  const [autopilotOpen, setAutopilotOpen] = useState(false);
  const emergencyLabel = getEmergencyLabel(aircraft);

  return (
    <div className={`flight-bubble ${emergencyLabel ? 'emergency' : ''}`}>
      {emergencyLabel && (
        <div className="emergency-banner">{emergencyLabel}</div>
      )}

      <div className="bubble-header">
        <div>
          <strong>{aircraft.flight || aircraft.hex}</strong>
          {aircraft.r && <span className="reg"> · {aircraft.r}</span>}
        </div>
        <button className="icon-btn" onClick={() => unpin(aircraft.hex)} aria-label="Close">✕</button>
      </div>

      <div className="bubble-type">
        {aircraft.t}{aircraft.year ? ` (${aircraft.year})` : ''}
      </div>

      {aircraft.ownOp && (
        <div className="bubble-row">{aircraft.ownOp}</div>
      )}

      <div className="bubble-section">
        <div className="bubble-row">
          {aircraft.alt_baro.toLocaleString()} ft
          {aircraft.baro_rate !== 0 && (
            <span className={aircraft.baro_rate > 0 ? 'climb' : 'descend'}>
              {' '}{aircraft.baro_rate > 0 ? '▲' : '▼'} {Math.abs(aircraft.baro_rate)} fpm
            </span>
          )}
        </div>
        <div className="bubble-row">
          {Math.round(aircraft.gs)} kts · {Math.round(aircraft.track)}°
          {aircraft.mach != null && ` · M${aircraft.mach.toFixed(2)}`}
        </div>
        {aircraft.squawk && (
          <div className="bubble-row">Squawk {aircraft.squawk}</div>
        )}
        <div className="bubble-row muted">{aircraft.seen}s ago</div>
      </div>

      {(aircraft.nav_altitude_mcp || aircraft.nav_heading || aircraft.nav_modes?.length) && (
        <details
          className="bubble-autopilot"
          open={autopilotOpen}
          onToggle={(e) => setAutopilotOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary>Autopilot</summary>
          {aircraft.nav_altitude_mcp != null && (
            <div className="bubble-row">Target alt: {aircraft.nav_altitude_mcp.toLocaleString()} ft</div>
          )}
          {aircraft.nav_heading != null && (
            <div className="bubble-row">Sel heading: {Math.round(aircraft.nav_heading)}°</div>
          )}
          {aircraft.nav_modes?.length && (
            <div className="bubble-row">Modes: {aircraft.nav_modes.join(', ')}</div>
          )}
        </details>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/FlightBubble/FlightPreview.tsx src/components/FlightBubble/FlightBubble.tsx
git commit -m "feat: add hover preview and pinned flight info bubble"
```

---

## Task 12: Map View

**Files:**
- Create: `src/components/MapView/AircraftMarker.tsx`
- Create: `src/components/MapView/MapView.tsx`

- [ ] **Step 1: Create AircraftMarker.tsx**

This component renders a Leaflet `DivIcon` containing an SVG silhouette, rotated to the aircraft's heading.

```tsx
// src/components/MapView/AircraftMarker.tsx
import { useMemo } from 'react';
import { Marker } from 'react-leaflet';
import { divIcon } from 'leaflet';
import type { Aircraft } from '../../types/aircraft';
import { aircraftColor } from '../../lib/colorSystem';
import { getAircraftFamily, SILHOUETTE_PATHS, SILHOUETTE_VIEWBOX } from '../../lib/silhouettes';
import { useAircraftStore } from '../../store/aircraftStore';
import { useSettingsStore } from '../../hooks/useSettings';

interface Props {
  aircraft: Aircraft;
}

// Scale silhouette to approximate wingspan in pixels at current zoom (handled via CSS zoom)
const ICON_SIZE = 40; // px

export function AircraftMarker({ aircraft }: Props) {
  const theme = useSettingsStore((s) => s.theme);
  const pin = useAircraftStore((s) => s.pin);
  const setHovered = useAircraftStore((s) => s.setHovered);
  const isPinned = useAircraftStore((s) => s.pinnedHexes.has(aircraft.hex));

  const color = aircraftColor(aircraft.t, theme);
  const family = getAircraftFamily(aircraft.t);
  const path = SILHOUETTE_PATHS[family];

  const icon = useMemo(
    () =>
      divIcon({
        className: '',
        iconSize: [ICON_SIZE, ICON_SIZE],
        iconAnchor: [ICON_SIZE / 2, ICON_SIZE / 2],
        html: `<svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="${SILHOUETTE_VIEWBOX}"
          width="${ICON_SIZE}"
          height="${ICON_SIZE}"
          style="transform: rotate(${aircraft.track}deg); overflow: visible;"
        >
          <defs>
            <filter id="glow-${aircraft.hex}" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="${isPinned ? 3 : 1.5}" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <path
            d="${path}"
            fill="none"
            stroke="${color}"
            stroke-width="3"
            filter="url(#glow-${aircraft.hex})"
          />
        </svg>`,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aircraft.track, aircraft.t, color, isPinned]
  );

  return (
    <Marker
      position={[aircraft._renderLat, aircraft._renderLon]}
      icon={icon}
      eventHandlers={{
        click: () => pin(aircraft.hex),
        mouseover: () => setHovered(aircraft.hex),
        mouseout: () => setHovered(null),
      }}
    />
  );
}
```

- [ ] **Step 2: Create MapView.tsx**

```tsx
// src/components/MapView/MapView.tsx
import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useAircraftStore } from '../../store/aircraftStore';
import { useSettingsStore } from '../../hooks/useSettings';
import { AircraftMarker } from './AircraftMarker';
import { FlightPreview } from '../FlightBubble/FlightPreview';
import { FlightBubble } from '../FlightBubble/FlightBubble';
import { interpolatePosition } from '../../lib/interpolate';
import { useCallback, useState } from 'react';

const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>';
const SAT_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SAT_ATTR = '&copy; Esri';

function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
}

export function MapView() {
  const { lat, lng, tileSource } = useSettingsStore();
  const aircraftMap = useAircraftStore((s) => s.aircraft);
  const pinnedHexes = useAircraftStore((s) => s.pinnedHexes);
  const hoveredHex = useAircraftStore((s) => s.hoveredHex);

  // Interpolate positions for all aircraft every 100ms
  const [renderTick, setRenderTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setRenderTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const aircraft = Array.from(aircraftMap.values()).map((ac) =>
    interpolatePosition(ac, now)
  );
  // Suppress unused variable warning — renderTick drives re-render
  void renderTick;

  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  const hoveredAircraft = hoveredHex ? aircraftMap.get(hoveredHex) : null;

  return (
    <div className="map-container" onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}>
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
        {aircraft.map((ac) => (
          <AircraftMarker key={ac.hex} aircraft={ac} />
        ))}
      </MapContainer>

      {hoveredAircraft && hoverPos && !pinnedHexes.has(hoveredAircraft.hex) && (
        <FlightPreview aircraft={hoveredAircraft} x={hoverPos.x} y={hoverPos.y} />
      )}

      <div className="bubbles-container">
        {[...pinnedHexes].map((hex) => {
          const ac = aircraftMap.get(hex);
          return ac ? <FlightBubble key={hex} aircraft={ac} /> : null;
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/MapView/AircraftMarker.tsx src/components/MapView/MapView.tsx
git commit -m "feat: add Leaflet map view with SVG DivIcon markers"
```

---

## Task 13: Radar View

**Files:**
- Create: `src/components/RadarView/RadarCanvas.ts`
- Create: `src/components/RadarView/RadarView.tsx`

- [ ] **Step 1: Create RadarCanvas.ts (pure draw functions)**

```ts
// src/components/RadarView/RadarCanvas.ts
import type { Aircraft } from '../../types/aircraft';
import { aircraftColor } from '../../lib/colorSystem';
import { getAircraftFamily, SILHOUETTE_PATHS } from '../../lib/silhouettes';
import { latLonToCanvas } from '../../lib/geoUtils';

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
}

export function drawRadar(params: RadarDrawParams) {
  const { ctx, width, height, theme } = params;
  ctx.clearRect(0, 0, width, height);

  const bg = theme === 'dark' ? '#0a0b0f' : '#f0f0f0';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  drawGrid(params);
  drawRings(params);
  drawCardinals(params);
  drawAllAircraft(params);
}

function drawRings({ ctx, width, height, radiusKm, ringIntervals, theme }: RadarDrawParams) {
  const cx = width / 2;
  const cy = height / 2;
  const scale = Math.min(width, height) / 2 / radiusKm;
  const ringColor = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
  const labelColor = theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)';

  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 1;
  ctx.font = '11px monospace';
  ctx.fillStyle = labelColor;
  ctx.textAlign = 'center';

  for (const km of ringIntervals) {
    if (km > radiusKm) continue;
    const r = km * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillText(`${km}km`, cx, cy - r + 14);
  }
}

function drawGrid({ ctx, width, height, centerLat, centerLon, radiusKm, theme }: RadarDrawParams) {
  const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;

  // Draw ~8 lat lines and ~8 lon lines
  const latStep = radiusKm / 111 / 4;
  const lonStep = radiusKm / (111 * Math.cos((centerLat * Math.PI) / 180)) / 4;
  const scale = Math.min(width, height) / 2 / radiusKm;

  for (let i = -4; i <= 4; i++) {
    // Latitude lines (horizontal)
    const dyKm = i * latStep * 111;
    const y = height / 2 - dyKm * scale;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    // Longitude lines (vertical)
    const dxKm = i * lonStep * 111 * Math.cos((centerLat * Math.PI) / 180);
    const x = width / 2 + dxKm * scale;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  void centerLon; // used via dxKm indirectly
}

function drawCardinals({ ctx, width, height, radiusKm, theme }: RadarDrawParams) {
  const cx = width / 2;
  const cy = height / 2;
  const scale = Math.min(width, height) / 2 / radiusKm;
  const outerR = radiusKm * scale;
  const color = theme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)';

  ctx.fillStyle = color;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillText('N', cx, cy - outerR - 12);
  ctx.fillText('S', cx, cy + outerR + 12);
  ctx.fillText('W', cx - outerR - 14, cy);
  ctx.fillText('E', cx + outerR + 14, cy);
}

const AIRCRAFT_SIZE = 28; // px on canvas

function drawAllAircraft(params: RadarDrawParams) {
  const { ctx, width, height, centerLat, centerLon, radiusKm, aircraft, hoveredHex, pinnedHexes, theme } = params;

  for (const ac of aircraft) {
    const pos = latLonToCanvas(ac._renderLat, ac._renderLon, centerLat, centerLon, radiusKm, width, height);
    if (pos.x < 0 || pos.x > width || pos.y < 0 || pos.y > height) continue;

    const color = aircraftColor(ac.t, theme);
    const family = getAircraftFamily(ac.t);
    const pathStr = SILHOUETTE_PATHS[family];
    const isHighlighted = hoveredHex === ac.hex || pinnedHexes.has(ac.hex);

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate((ac.track * Math.PI) / 180);
    ctx.scale(AIRCRAFT_SIZE / 200, AIRCRAFT_SIZE / 200); // viewBox is 100x200

    const p = new Path2D(pathStr);

    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = isHighlighted ? 20 : 8;

    ctx.strokeStyle = color;
    ctx.lineWidth = isHighlighted ? 5 : 3;
    ctx.stroke(p);

    ctx.restore();
  }
}
```

- [ ] **Step 2: Create RadarView.tsx**

```tsx
// src/components/RadarView/RadarView.tsx
import { useEffect, useRef } from 'react';
import { useAircraftStore } from '../../store/aircraftStore';
import { useSettingsStore } from '../../hooks/useSettings';
import { interpolatePosition } from '../../lib/interpolate';
import { drawRadar } from './RadarCanvas';
import { FlightBubble } from '../FlightBubble/FlightBubble';
import { FlightPreview } from '../FlightBubble/FlightPreview';
import { latLonToCanvas } from '../../lib/geoUtils';
import { useState, useCallback } from 'react';

export function RadarView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const { lat, lng, radiusKm, ringIntervals, theme } = useSettingsStore();
  const aircraftMap = useAircraftStore((s) => s.aircraft);
  const pinnedHexes = useAircraftStore((s) => s.pinnedHexes);
  const hoveredHex = useAircraftStore((s) => s.hoveredHex);
  const pin = useAircraftStore((s) => s.pin);
  const setHovered = useAircraftStore((s) => s.setHovered);

  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const hoveredAircraft = hoveredHex ? aircraftMap.get(hoveredHex) : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const loop = () => {
      const now = Date.now();
      const aircraft = Array.from(aircraftMap.values()).map((ac) =>
        interpolatePosition(ac, now)
      );

      drawRadar({
        ctx,
        width: canvas.width,
        height: canvas.height,
        centerLat: lat,
        centerLon: lng,
        radiusKm,
        ringIntervals,
        aircraft,
        hoveredHex,
        pinnedHexes,
        theme,
      });

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [lat, lng, radiusKm, ringIntervals, theme, aircraftMap, hoveredHex, pinnedHexes]);

  // Resize canvas to fill container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    observer.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => observer.disconnect();
  }, []);

  // Hit-test aircraft on click/hover
  const hitTest = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      for (const ac of aircraftMap.values()) {
        const pos = latLonToCanvas(
          ac._renderLat, ac._renderLon, lat, lng, radiusKm, canvas.width, canvas.height
        );
        const dist = Math.hypot(mx - pos.x, my - pos.y);
        if (dist < 18) return ac.hex;
      }
      return null;
    },
    [aircraftMap, lat, lng, radiusKm]
  );

  return (
    <div className="radar-container">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        onClick={(e) => {
          const hex = hitTest(e.clientX, e.clientY);
          if (hex) pin(hex);
        }}
        onMouseMove={(e) => {
          setHoverPos({ x: e.clientX, y: e.clientY });
          const hex = hitTest(e.clientX, e.clientY);
          setHovered(hex);
        }}
        onMouseLeave={() => setHovered(null)}
      />

      {hoveredAircraft && hoverPos && !pinnedHexes.has(hoveredAircraft.hex) && (
        <FlightPreview aircraft={hoveredAircraft} x={hoverPos.x} y={hoverPos.y} />
      )}

      <div className="bubbles-container">
        {[...pinnedHexes].map((hex) => {
          const ac = aircraftMap.get(hex);
          return ac ? <FlightBubble key={hex} aircraft={ac} /> : null;
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/RadarView/RadarCanvas.ts src/components/RadarView/RadarView.tsx
git commit -m "feat: add canvas radar view with rings, grid, and silhouettes"
```

---

## Task 14: App Shell and Global CSS

**Files:**
- Modify: `src/App.tsx` (full rewrite)
- Modify: `src/index.css` (full rewrite)
- Modify: `src/main.tsx` (remove App.css import if any)

- [ ] **Step 1: Rewrite index.css**

Replace the entire file with:

```css
/* src/index.css */

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  overflow: hidden;
}

#root {
  width: 100vw;
  height: 100vh;
  position: relative;
}

/* ─── Theme variables ─── */
body.theme-dark {
  --bg: #0a0b0f;
  --surface: rgba(15, 16, 22, 0.9);
  --border: rgba(255,255,255,0.1);
  --text: #e5e7eb;
  --text-muted: #6b7280;
  --accent: #7c3aed;
  --accent-light: #a78bfa;
  --chip-bg: rgba(255,255,255,0.08);
  --chip-active: rgba(124, 58, 237, 0.7);
  --shadow: 0 4px 20px rgba(0,0,0,0.6);
}

body.theme-light {
  --bg: #f0f0f0;
  --surface: rgba(240, 242, 248, 0.92);
  --border: rgba(0,0,0,0.12);
  --text: #1f2937;
  --text-muted: #6b7280;
  --accent: #7c3aed;
  --accent-light: #7c3aed;
  --chip-bg: rgba(0,0,0,0.07);
  --chip-active: rgba(124, 58, 237, 0.15);
  --shadow: 0 4px 20px rgba(0,0,0,0.15);
}

/* ─── Full-bleed containers ─── */
.map-container,
.radar-container {
  position: absolute;
  inset: 0;
}

/* ─── Floating UI shell ─── */
.hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1000;
}

.hud > * { pointer-events: auto; }

.hud-topleft {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hud-topright {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 6px;
}

.hud-bottomleft {
  position: absolute;
  bottom: 12px;
  left: 12px;
}

/* ─── App logo ─── */
.app-logo {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 12px;
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow);
  letter-spacing: 0.05em;
}

/* ─── Chip groups ─── */
.chip-group {
  display: flex;
  gap: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px;
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow);
}

.chip {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-radius: 5px;
  padding: 4px 10px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.chip:hover { color: var(--text); background: var(--chip-bg); }
.chip.active { color: #fff; background: var(--chip-active); }

/* ─── Icon buttons ─── */
.icon-btn {
  font-size: 14px;
  color: var(--text-muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow);
  transition: color 0.15s;
}

.icon-btn:hover { color: var(--text); }

/* ─── Status chip ─── */
.status-chip {
  font-size: 12px;
  font-family: monospace;
  color: var(--text-muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 12px;
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow);
  transition: border-color 0.3s;
}

.status-chip.stale { border-color: #f59e0b; color: #f59e0b; }

/* ─── Flight preview tooltip ─── */
.flight-preview {
  position: fixed;
  pointer-events: none;
  z-index: 2000;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow);
  min-width: 140px;
}

.fp-callsign {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  font-family: monospace;
}

.fp-type {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.fp-data {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
  font-family: monospace;
}

/* ─── Flight bubble (pinned) ─── */
.bubbles-container {
  position: absolute;
  top: 60px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1500;
  max-width: 260px;
}

.flight-bubble {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow);
  font-size: 13px;
  color: var(--text);
}

.flight-bubble.emergency {
  border-color: #ef4444;
  animation: pulse-border 1.5s ease-in-out infinite;
}

@keyframes pulse-border {
  0%, 100% { border-color: #ef4444; }
  50% { border-color: #fca5a5; }
}

.emergency-banner {
  background: #ef4444;
  color: #fff;
  font-weight: 700;
  font-size: 12px;
  border-radius: 5px;
  padding: 4px 8px;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.bubble-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-family: monospace;
  font-size: 15px;
  font-weight: 700;
}

.bubble-header .icon-btn {
  font-size: 11px;
  padding: 2px 6px;
  background: transparent;
  box-shadow: none;
}

.reg { font-weight: 400; color: var(--text-muted); }

.bubble-type {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
  margin-bottom: 8px;
}

.bubble-section { border-top: 1px solid var(--border); padding-top: 8px; }

.bubble-row {
  font-family: monospace;
  font-size: 12px;
  color: var(--text);
  margin-bottom: 3px;
}

.bubble-row.muted { color: var(--text-muted); }

.climb { color: #34d399; }
.descend { color: #f87171; }

.bubble-autopilot {
  margin-top: 8px;
  border-top: 1px solid var(--border);
  padding-top: 8px;
}

.bubble-autopilot summary {
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  user-select: none;
}

/* ─── Modal ─── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px 24px;
  min-width: 340px;
  max-width: 480px;
  width: 100%;
  box-shadow: var(--shadow);
  backdrop-filter: blur(16px);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-body label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
}

.modal-body input,
.modal-body select {
  font-size: 14px;
  color: var(--text);
  background: var(--chip-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 10px;
  outline: none;
  transition: border-color 0.15s;
}

.modal-body input:focus,
.modal-body select:focus { border-color: var(--accent-light); }

.modal-body input[type=range] {
  padding: 0;
  border: none;
  background: transparent;
}
```

- [ ] **Step 2: Rewrite App.tsx**

```tsx
// src/App.tsx
import { useEffect, useState } from 'react';
import { useSettingsStore } from './hooks/useSettings';
import { useAircraftFeed } from './hooks/useAircraftFeed';
import { useAircraftStore } from './store/aircraftStore';
import { MapView } from './components/MapView/MapView';
import { RadarView } from './components/RadarView/RadarView';
import { SettingsModal } from './components/SettingsPanel/SettingsModal';

function StatusChip() {
  const lastUpdated = useAircraftStore((s) => s.lastUpdated);
  const aircraft = useAircraftStore((s) => s.aircraft);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const secondsAgo = lastUpdated ? Math.round((now - lastUpdated) / 1000) : null;
  const isStale = secondsAgo != null && secondsAgo > 15;

  return (
    <div className={`status-chip ${isStale ? 'stale' : ''}`}>
      {aircraft.size} aircraft
      {secondsAgo != null && ` · ${secondsAgo}s ago`}
    </div>
  );
}

export default function App() {
  const settings = useSettingsStore();
  const [showSettings, setShowSettings] = useState(false);

  // Apply theme class to body
  useEffect(() => {
    document.body.className = `theme-${settings.theme}`;
  }, [settings.theme]);

  // Start the feed
  useAircraftFeed();

  return (
    <>
      {/* Main view */}
      {settings.view === 'map' ? <MapView /> : <RadarView />}

      {/* HUD overlay */}
      <div className="hud">
        {/* Top-left: logo + view switcher + tile switcher */}
        <div className="hud-topleft">
          <div className="app-logo">✈ FlightTracker</div>

          <div className="chip-group">
            <button
              className={`chip ${settings.view === 'map' ? 'active' : ''}`}
              onClick={() => settings.update({ view: 'map' })}
            >
              MAP
            </button>
            <button
              className={`chip ${settings.view === 'radar' ? 'active' : ''}`}
              onClick={() => settings.update({ view: 'radar' })}
            >
              RADAR
            </button>
          </div>

          {settings.view === 'map' && (
            <div className="chip-group">
              <button
                className={`chip ${settings.tileSource === 'osm' ? 'active' : ''}`}
                onClick={() => settings.update({ tileSource: 'osm' })}
              >
                OSM
              </button>
              <button
                className={`chip ${settings.tileSource === 'satellite' ? 'active' : ''}`}
                onClick={() => settings.update({ tileSource: 'satellite' })}
              >
                SAT
              </button>
            </div>
          )}
        </div>

        {/* Top-right: theme toggle + settings */}
        <div className="hud-topright">
          <button
            className="icon-btn"
            onClick={() => settings.update({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
            title="Toggle theme"
          >
            {settings.theme === 'dark' ? '☀' : '☾'}
          </button>
          <button
            className="icon-btn"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙
          </button>
        </div>

        {/* Bottom-left: status */}
        <div className="hud-bottomleft">
          <StatusChip />
        </div>
      </div>

      {/* Settings modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
```

- [ ] **Step 3: Check main.tsx and remove any App.css import**

Read `src/main.tsx`. If it imports `./App.css`, remove that import. The file should look like:

```tsx
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 4: Run the test suite to ensure nothing is broken**

```bash
npx vitest run
```
Expected: all tests PASS (no new failures)

- [ ] **Step 5: Start dev server and verify the app loads**

```bash
npm run dev
```

Open `http://localhost:5173`. Verify:
- App loads without console errors
- Dark theme applied (near-black background)
- HUD controls visible (logo, MAP/RADAR chips, theme toggle, settings button)
- Status chip shows "0 aircraft · Xs ago" (or actual aircraft if CORS allows)
- Switching MAP↔RADAR works
- Opening settings modal works; changes persist on reload
- Leaflet map tiles load

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/index.css src/main.tsx
git commit -m "feat: add app shell with floating HUD, theme toggle, and view switcher"
```

---

## Task 15: Verify the Full Golden Path

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```
Expected: all PASS

- [ ] **Step 2: Build for production**

```bash
npm run build
```
Expected: no TypeScript errors, build succeeds

- [ ] **Step 3: Smoke test the running app**

Start dev server:
```bash
npm run dev
```

Manually verify each feature:
1. MAP view loads with Leaflet tiles
2. RADAR view renders rings + cardinal labels
3. Tile switcher (OSM ↔ SAT) works in MAP view
4. Theme toggle switches between dark/light
5. Settings modal opens, all inputs work, changes persist on refresh
6. Status chip updates every second
7. Aircraft appear and can be clicked to pin
8. Pinned bubble shows all fields; ✕ button unpins
9. Hover shows preview tooltip

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete flight tracker MVP — map, radar, bubbles, settings"
```

---

## Self-Review Against Spec

| Spec requirement | Task |
|---|---|
| React-Leaflet map view | Task 12 |
| OSM + ESRI satellite tiles | Task 12 |
| Canvas radar scope | Task 13 |
| Concentric rings + lat/lon grid | Task 13 |
| Cardinal labels | Task 13 |
| View switcher (MAP/RADAR) | Task 14 |
| Tile switcher (OSM/SAT) | Task 14 |
| Theme toggle (dark/light) | Task 14 |
| Settings modal | Task 10 |
| All settings fields | Task 10 |
| localStorage persistence | Task 6 |
| Deterministic color by manufacturer | Task 2 |
| ~12 silhouette families | Task 3 |
| Neon outline + glow | Tasks 12, 13 |
| SVG DivIcon, rotated to heading | Task 12 |
| Hover tooltip | Task 11 |
| Click-to-pin bubble | Tasks 11, 12, 13 |
| Multiple simultaneous pins | Task 11 |
| Emergency banner + pulse | Task 11 |
| All emergency squawk labels | Task 11 |
| Enhanced glow for emergency | Task 11 (spec gap — add `isEmergency` prop to RadarCanvas and increase shadowBlur; update AircraftMarker filter stdDeviation) |
| Position interpolation | Tasks 5, 12, 13 |
| Stale removal (2 polls) | Task 7 (removeStale called on each poll) |
| Status chip w/ stale > 15s amber | Task 14 |
| Zustand store | Task 7 |
| airplanes.live API | Task 8 |
| Refresh interval 1–30s | Tasks 6, 9 |

**Emergency glow gap fix** (add to Task 13 RadarCanvas.ts `drawAllAircraft`):

```ts
// After computing isHighlighted, also check for emergency:
const isEmergency = !!ac.emergency || ac.squawk === '7700' || ac.squawk === '7600' || ac.squawk === '7500';
ctx.shadowBlur = isEmergency ? 35 : isHighlighted ? 20 : 8;
ctx.lineWidth = isEmergency ? 6 : isHighlighted ? 5 : 3;
```

And in `AircraftMarker.tsx`, update the filter:

```ts
const isEmergency = !!aircraft.emergency || ['7700','7600','7500'].includes(aircraft.squawk ?? '');
const glowStdDev = isEmergency ? 5 : isPinned ? 3 : 1.5;
// Use glowStdDev in the feGaussianBlur stdDeviation
```
