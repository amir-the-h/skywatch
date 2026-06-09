# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (root)
```bash
npm run dev          # Vite dev server with HMR (http://localhost:5173)
npm test             # Vitest unit tests (jsdom environment)
npm run test:watch   # Vitest in watch mode
npm run lint         # ESLint
npm run build        # tsc + Vite production build
npm run generate:airports  # Regenerate public/airports.json from source data
```

### Backend (backend/)
```bash
cd backend
npm run dev          # tsx watch (hot-reload)
npm run start        # tsx (one-shot)
npm test             # Vitest unit tests
```

### Running a single test
```bash
# Frontend
npx vitest run src/lib/colorSystem.test.ts

# Backend
cd backend && npx vitest run src/AircraftMerger.test.ts
```

### Local dev stack
```bash
docker run -d -p 6379:6379 redis:7-alpine
cd backend && REDIS_URL=redis://localhost:6379 npx tsx src/server.ts
VITE_BACKEND_URL=http://localhost:3001 npm run dev
```

## Architecture

### Two-package layout
- **Root** — React 19 + Vite frontend (ESM)
- **`backend/`** — Node.js + Express + Socket.IO server (CommonJS)
- **`shared/types.ts`** — canonical TypeScript types shared between both packages (imported via relative `../../shared/types`)

### Backend data flow
1. Each Socket.IO client sends `register_location { lat, lon, radiusKm }`.
2. `GridEngine.snapToGrid` snaps the location to a ~5 km cell (0.045° grid).
3. `FetchQueue` maintains one polling timer per active cell; polls at `POLL_INTERVAL_MS`.
4. `CellPoller.pollCell` fans out to all configured `ADS_SOURCES` in parallel, normalizes raw ADS-B JSON, then calls `AircraftMerger.mergeAircraftSources` to produce one record per hex.
5. Merged aircraft are written to `RedisStore` (individual hash + path history list + cell hex set), then pushed to each socket filtered by that socket's exact radius.
6. `MetarPoller` independently fetches METAR for airports in each socket's radius and pushes `metar_update` / `center_weather` events.

### Frontend data flow
- `useAircraftSocket` connects via Socket.IO, emits `register_location` on connect/settings change, and feeds incoming `aircraft_update` into `aircraftStore` and `airports` into `airportStore`/`metarStore`/`centerWeatherStore`.
- All state is Zustand. Stores: `aircraftStore`, `airportStore`, `filterStore`, `metarStore`, `centerWeatherStore`, `useSettings` (settings + localStorage persistence).
- `useSettings` persists center lat/lng, radius, view mode, and tile source to `localStorage`.
- Aircraft positions are stored with `_renderLat/_renderLon` for client-side interpolation (`src/lib/interpolate.ts`) between server pushes.
- Two views share the same stores: `MapView` (Leaflet) and `RadarView` (Canvas 2D sweep radar).

### ADS-B sources
`ADS_SOURCES` (comma-separated) or `ADS_SOURCE` env var. Priority = order in the list (index 0 = highest). `AircraftMerger` takes live fields (position, altitude, speed) from the highest-priority source and fills sticky fields (callsign, registration, route) from lower-priority sources when the primary is missing them.

### Key backend modules
| File | Role |
|------|------|
| `server.ts` | Socket.IO lifecycle, `socketMap`/`cellMap` bookkeeping |
| `GridEngine.ts` | Grid snap + cell key |
| `FetchQueue.ts` | Per-cell interval polling with add/remove |
| `CellPoller.ts` | HTTP fan-out to ADS-B sources, normalization, per-socket filtering |
| `AircraftMerger.ts` | Priority-order merge of multi-source results |
| `AircraftProcessor.ts` | `inferFlightPhase` from alt/gs/baro_rate |
| `RedisStore.ts` | Aircraft hash, path history (list), cell hex sets, airport geo, METAR |
| `MetarPoller.ts` | Periodic METAR + center weather push per socket |

### Key frontend modules
| Path | Role |
|------|------|
| `src/lib/interpolate.ts` | Smooth position interpolation between server ticks |
| `src/lib/colorSystem.ts` | Manufacturer-based aircraft color assignment |
| `src/lib/aircraftFilter.ts` | Filter predicate applied in views |
| `src/lib/labelVisibility.ts` | Zoom/density-based label declutter |
| `src/components/RadarView/RadarCanvas.ts` | Canvas 2D radar sweep renderer |
| `src/components/RadarView/viewTransform.ts` | Geo↔canvas coordinate transform |
| `src/hooks/useVersionPoller.ts` | Auto-reload on new backend deploy |
