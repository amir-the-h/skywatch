# Flight Tracker — Design Spec
**Date:** 2026-06-07

## Overview

A personal flight tracking web app built with React + Vite. Fetches live ADS-B data from the airplanes.live API and renders aircraft as neon-style top-down silhouettes on two interchangeable views: a Leaflet slippy map and a radar/canvas scope. Aircraft are color-coded by a deterministic hash of manufacturer and model. The UI is full-bleed with floating controls.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | React 18 + Vite |
| Language | TypeScript |
| Map | React-Leaflet |
| Map tiles (default) | OpenStreetMap |
| Map tiles (satellite) | ESRI World Imagery (free, no key) |
| Radar rendering | HTML Canvas + requestAnimationFrame |
| State | Zustand |
| Persistence | localStorage |
| Data source | airplanes.live REST API |

---

## Views

### Map View
- React-Leaflet map fills the entire viewport
- Tile source toggleable between OSM and ESRI satellite
- Aircraft rendered as SVG `DivIcon` markers, rotated to true heading
- Silhouettes scaled to approximate real wingspan relative to current zoom level

### Radar View
- Full-viewport HTML Canvas — background is near-black in dark theme, near-white in light theme
- Centered on configured lat/lng
- Concentric range rings at configurable intervals (default: 25 km, 50 km, 100 km, 150 km)
- Subtle lat/lon coordinate grid
- Cardinal direction labels (N/S/E/W) at ring edges
- Aircraft scaled proportionally to the configured proximity radius
- Aircraft rendered with neon glow silhouettes, rotated to heading

---

## UI Shell

Full-bleed layout — map/canvas fills the entire window. All controls float over the surface:

- **Top-left:** App logo + view switcher chips (MAP / RADAR) + tile switcher (OSM / SAT, visible in map view only)
- **Top-right:** Theme toggle (dark/light) + settings button
- **Bottom-left:** Status chip — aircraft count + time since last update (turns amber if stale > 15s)
- **Settings:** Opens as a modal overlay (not a slide-in panel)

### Settings Modal Fields
- Latitude / Longitude (center point)
- Radius (km) — controls both API bounding box and radar scope scale
- Refresh interval (1–30s, default 5s)
- Theme (dark / light)
- Radar ring intervals (comma-separated km values)

All settings persisted to `localStorage`.

---

## Aircraft Color System

Fully deterministic, zero configuration required.

```
hash(manufacturerName) → hue (0–360°)
hash(aircraftType)     → lightness offset within hue
```

**Manufacturer derivation:** The airplanes.live feed provides ICAO type codes (`B738`, `A320`, `CRJ9`) but not manufacturer names. A bundled static lookup table maps ICAO type prefixes to manufacturer strings (e.g. `B7xx` → `"Boeing"`, `A3xx` → `"Airbus"`, `CRJ` → `"Bombardier"`). Unknown types fall back to hashing the raw type code for both hue and shade — still deterministic, still consistent.

- **Dark theme:** lightness 55–80%, saturation 90–100% → bright neon
- **Light theme:** lightness 35–55%, saturation 90–100% → readable on pale background
- New or unknown manufacturers/types automatically receive a consistent color derived from their string hash
- All planes from the same manufacturer share a hue family; individual types are distinguishable shades within that family

---

## Aircraft Silhouettes

~20 SVG path sets covering the major commercial aircraft families, rendered top-down:

| Family | Examples |
|---|---|
| Narrowbody single-aisle (short) | A319, A320, B737-700/800 |
| Narrowbody single-aisle (long) | A321, B737-900, B757 |
| Widebody twin-aisle (medium) | A330, B767, B787-8 |
| Widebody twin-aisle (large) | A350, B777, B787-10 |
| Very large | A380, B747 |
| Regional jet (small) | CRJ200, ERJ145 |
| Regional jet (medium) | CRJ700/900, E170/175 |
| Regional jet (large) | E190/195 |
| Turboprop | ATR42/72, Q400 |
| Bizjet (small) | Citation, Phenom |
| Bizjet (large) | Gulfstream, Global |
| Military / unknown | Generic delta silhouette |

Silhouettes are neon outline only (stroke, no fill), with a CSS/SVG feGaussianBlur glow filter. Glow intensity is uniform across all aircraft.

---

## Flight Bubble

Triggered in two stages:

- **Hover → preview:** lightweight tooltip showing callsign, aircraft type, altitude, ground speed
- **Click → pin:** full info card locked open until clicked elsewhere or dismissed

### Pinned Bubble Contents

**Header**
- Callsign + airline ICAO code
- Aircraft type + registration

**Flight**
- Origin → Destination (IATA + city name when provided by feed; falls back to showing callsign only if unavailable)
- Owner/operator (`ownOp`)

**Position**
- Altitude (ft) · Ground speed (kts) · Heading (°)
- Vertical speed (ft/min) with ▲▼ indicator
- Mach number (if available)

**Autopilot** *(collapsible section)*
- Target altitude (`nav_altitude_mcp`)
- Selected heading (`nav_heading`)
- Active modes (`nav_modes`)

**Other**
- Squawk code
- Year of manufacture
- Data freshness (`seen` seconds ago)

**Emergency banner** *(shown only when active)*
- Red pulsing border on the entire bubble
- Prominent red banner at top: `7700 — General Emergency`
- Full label map:

| Squawk / Field | Label |
|---|---|
| 7700 / `general` | General Emergency |
| 7600 / `nordo` | Radio Failure (NORDO) |
| 7500 / `unlawful` | Hijacking |
| `lifeguard` | Medical Emergency |
| `minfuel` | Minimum Fuel |
| `downed` | Downed Aircraft |

Emergency aircraft also have enhanced glow intensity — the only exception to the uniform glow rule.

Multiple bubbles can be pinned simultaneously.

---

## Data Flow

```
useAircraftFeed (polling hook)
  └─ every N seconds (configurable, default 5s)
  └─ fetches airplanes.live bounding box around lat/lng + radius
  └─ normalizes response → Aircraft[]
  └─ merges into Zustand aircraftStore (keyed by ICAO hex)
  └─ updates lastUpdated timestamp

aircraftStore
  ├─ MapView subscribes → re-renders changed DivIcon markers
  └─ RadarView subscribes → next rAF frame redraws changed aircraft

Position interpolation
  └─ between polls, each aircraft steps forward: heading + gs × Δt
  └─ capped at 10s — aircraft silent beyond that fades out

Aircraft exit
  └─ missing from 2 consecutive polls → opacity fade → removed from store
```

---

## Project Structure

```
src/
├── api/
│   └── airplanesLive.ts        # fetch + normalize feed response
├── store/
│   └── aircraftStore.ts        # Zustand — Map<hex, Aircraft>, pinnedHex, hoveredHex
├── hooks/
│   ├── useAircraftFeed.ts      # polling loop
│   └── useSettings.ts          # localStorage-backed settings
├── lib/
│   ├── colorSystem.ts          # hash → HSL color
│   ├── silhouettes.ts          # SVG path data per family
│   ├── geoUtils.ts             # lat/lng ↔ canvas px, bounding box, haversine distance
│   └── interpolate.ts          # position stepping between polls
├── components/
│   ├── App.tsx                 # root — floating controls, view switcher, modal state
│   ├── MapView/
│   │   ├── MapView.tsx         # React-Leaflet map + tile switcher
│   │   └── AircraftMarker.tsx  # SVG DivIcon, rotated + scaled
│   ├── RadarView/
│   │   ├── RadarView.tsx       # canvas container + rAF loop
│   │   └── RadarCanvas.ts      # pure draw functions (rings, grid, aircraft)
│   ├── FlightBubble/
│   │   ├── FlightBubble.tsx    # pinned full-info card
│   │   └── FlightPreview.tsx   # lightweight hover tooltip
│   └── SettingsPanel/
│       └── SettingsModal.tsx   # settings modal
└── types/
    └── aircraft.ts             # Aircraft, Settings, AircraftFamily types
```

---

## Types (outline)

```ts
interface Aircraft {
  hex: string;
  flight: string;           // callsign
  r: string;                // registration
  t: string;                // ICAO type code (e.g. "B738")
  lat: number;
  lon: number;
  alt_baro: number;
  gs: number;               // ground speed kts
  track: number;            // true track degrees
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
  // interpolation state (client-side only)
  _renderLat: number;
  _renderLon: number;
  _lastSeen: number;        // timestamp ms
}

interface Settings {
  lat: number;
  lng: number;
  radiusKm: number;
  refreshInterval: number;  // seconds
  theme: 'dark' | 'light';
  tileSource: 'osm' | 'satellite';
  view: 'map' | 'radar';
  ringIntervals: number[];  // km
}
```

---

## Out of Scope (v1)

- Flight history / trails
- Push notifications for specific aircraft
- Server-side proxy (direct browser → airplanes.live API calls)
- Mobile / touch optimization
- Multiple center points
