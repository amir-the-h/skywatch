# Backend Service Design

**Date:** 2026-06-07  
**Status:** Approved

## Overview

Move data collection, path history, and flight phase computation from the browser to a Node.js backend service. Backend polls airplanes.live, maintains state in Redis, and pushes live updates to connected clients via Socket.io. Frontend becomes a pure render layer.

---

## Repo Layout

```
flight-tracker/
├── shared/
│   └── types.ts             # BackendAircraft, FlightPhase — shared by frontend + backend
├── backend/
│   ├── src/
│   │   ├── server.ts        # Socket.io + Express entry point
│   │   ├── GridEngine.ts    # 5km grid snapping, cell lifecycle management
│   │   ├── FetchQueue.ts    # Global 1 req/s fetch queue, round-robin across cells
│   │   ├── CellPoller.ts    # Per-cell fetch, process, broadcast
│   │   ├── AircraftProcessor.ts  # Flight phase + path history computation
│   │   └── RedisStore.ts    # All Redis read/write operations
│   ├── package.json
│   └── tsconfig.json
├── src/                     # Frontend (existing structure, unchanged)
├── docker-compose.yml
└── package.json             # Frontend (unchanged)
```

---

## Services

Three Docker services, all on the same internal network. No ports exposed to host — Nginx Proxy Manager (NPM) container routes by service name.

```yaml
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped

  backend:
    build: ./backend
    restart: unless-stopped
    environment:
      REDIS_URL: redis://redis:6379
      POLL_INTERVAL_MS: 1000
      AIRPLANES_LIVE_BASE: https://api.airplanes.live/v2/point
    depends_on: [redis]

  frontend:
    build: .
    restart: unless-stopped
    depends_on: [backend]
```

**NPM proxy hosts:**
- `skywatch.the-h.me` → `frontend:80`
- `skywatch.the-h.me/socket.io` → `backend:3001` (WebSocket support enabled)

Frontend env var: `VITE_BACKEND_URL=https://skywatch.the-h.me`

---

## Redis Key Design

### Aircraft keys
```
aircraft:{hex}          Hash   { hex, flight, r, t, desc, lat, lon, alt_baro, gs,
                                  track, baro_rate, mach, squawk, emergency,
                                  nav_altitude_mcp, nav_heading, nav_modes, ownOp,
                                  year, orig_iata, dest_iata, orig_name, dest_name,
                                  seen, phase }
                                TTL: 30s — reset on each fetch, auto-expires when gone

aircraft:{hex}:path     List   [ {lat, lon}, ... ]  capped at 50 via LPUSH + LTRIM
                                TTL: 30s — same as parent hash
```

### Cell keys
```
cell:{gLat}:{gLon}:meta     Hash   { fetchLat, fetchLon, maxRadiusKm }
cell:{gLat}:{gLon}:hexes    Set    of hex strings currently in this cell
```
Cell keys are deleted when the last socket leaves that cell.

### In-memory (not Redis)
```
socketMap: Map<socketId, { gLat, gLon, radiusKm }>
cellSockets: Map<cellKey, Set<socketId>>
```
Single backend instance — no need for Redis coordination of socket state.

---

## Grid Snapping

```
CELL_DEG = 0.045   // ≈ 5km
gLat = Math.round(lat / CELL_DEG) * CELL_DEG
gLon = Math.round(lon / CELL_DEG) * CELL_DEG
cellKey = `${gLat}:${gLon}`
```

Cell's `maxRadiusKm` = max of all connected sockets' `radiusKm` at that cell. Recomputed on each `register_location` event and disconnect.

Each socket still receives only aircraft within its own `radiusKm` — the cell fetches at `maxRadiusKm` then filters per-socket before emit.

---

## Rate Limiting & Fetch Queue

airplanes.live enforces 1 request/second (assumed per-IP). A single global `FetchQueue` manages all cell fetches:

- Runs a `setInterval` every `POLL_INTERVAL_MS` (default 1000ms)
- Maintains a round-robin ordered list of active cell keys
- Each tick: dequeue next cell → fetch → process → broadcast → requeue at back
- With N active cells, each cell refreshes every N seconds minimum

No per-cell intervals. All airplanes.live requests go through this single queue.

---

## Cell Lifecycle

**Activation** (first socket registers at a cell):
1. Add socket to `cellSockets` map
2. Create `cell:{gLat}:{gLon}:meta` in Redis
3. Add cell to `FetchQueue`

**Poll cycle** (triggered by FetchQueue):
1. Fetch `airplanes.live/v2/point/{fetchLat}/{fetchLon}/{maxRadiusNm}`
2. For each aircraft returned:
   - Compute `flightPhase` via `AircraftProcessor`
   - `LPUSH aircraft:{hex}:path {lat,lon}` + `LTRIM` to 50 + `EXPIRE aircraft:{hex}:path 30`
   - `HSET aircraft:{hex}` with fresh data + `EXPIRE aircraft:{hex} 30`
3. Replace `cell:{gLat}:{gLon}:hexes` with current fetch hex set
4. For each socket in `cellSockets[cellKey]`:
   - Fetch all aircraft data from Redis for cell hexes
   - Filter to socket's `radiusKm`
   - Emit `aircraft_update`

**Location update** (socket emits `register_location` with new lat/lon/radius):
- If same snapped cell: update `radiusKm` in `socketMap`, recompute cell `maxRadiusKm`
- If different cell: remove from old cell (deactivate if empty), activate new cell

**Deactivation** (last socket leaves a cell):
1. Remove from `FetchQueue`
2. Delete `cell:{gLat}:{gLon}:meta` and `cell:{gLat}:{gLon}:hexes` from Redis
3. (Aircraft keys expire naturally via TTL)

---

## Socket.io Protocol

### Client → Server
```
register_location   { lat: number, lon: number, radiusKm: number }
```
Sent on connect and on every settings change (lat, lon, or radiusKm). Single event handles both initial registration and updates.

### Server → Client
```
aircraft_update   {
  aircraft: BackendAircraft[],   // filtered to this socket's radiusKm
  cell: { lat: number, lon: number, radiusKm: number }
}
```

---

## Shared Types (`shared/types.ts`)

```ts
export type FlightPhase = 'TXI' | 'GND' | 'T/O' | 'APP' | 'CLB' | 'DSC' | 'CRZ';

export interface BackendAircraft {
  hex: string;
  flight: string;
  r: string;
  t: string;
  desc?: string;
  lat: number;
  lon: number;
  alt_baro: number;
  gs: number;
  track: number;
  baro_rate: number;
  mach?: number;
  squawk?: string;
  emergency?: string;
  nav_altitude_mcp?: number;
  nav_heading?: number;
  nav_modes?: string[];
  ownOp?: string;
  year?: string;
  orig_iata?: string;
  dest_iata?: string;
  orig_name?: string;
  dest_name?: string;
  seen: number;
  phase: FlightPhase;
  pathHistory: { lat: number; lon: number }[];
}
```

---

## Frontend Changes

**Removed:**
- `src/api/airplanesLive.ts` — no longer called from browser
- `src/hooks/useAircraftFeed.ts` — replaced by socket hook
- Client-side path history accumulation in `aircraftStore.ts`
- `refreshInterval` from `Settings` type and `SettingsModal`

**Added:**
- `socket.io-client` dependency
- `src/hooks/useAircraftSocket.ts` — connects to backend, emits `register_location` on mount and settings change, listens for `aircraft_update` and calls `mergeAircraft`

**Removed (continued):**
- `src/lib/flightPhase.ts` — phase now computed by backend, arrives in `BackendAircraft.phase`

**Unchanged:**
- `interpolatePosition` — stays client-side for smooth rendering between updates
- `aircraftStore.ts` mergeAircraft logic — receives `BackendAircraft[]`, maps to `Aircraft[]` adding `_renderLat`, `_renderLon`, `_lastSeen`
- `colorSystem.ts` reads `phase` field from aircraft directly (field still present, source changes)
- All rendering components

---

## AircraftProcessor (backend)

Moves from frontend to backend:
- `inferFlightPhase(ac)` — identical logic, computed before Redis write
- Path history — `LPUSH` + `LTRIM 0 49` on `aircraft:{hex}:path`
- `interpolatePosition` stays on **frontend only** — backend always stores true GPS position

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `POLL_INTERVAL_MS` | `1000` | FetchQueue tick interval (ms) |
| `AIRPLANES_LIVE_BASE` | `https://api.airplanes.live/v2/point` | API base URL |
| `PORT` | `3001` | Socket.io server port |
| `VITE_BACKEND_URL` | *(required)* | Frontend Socket.io connection target |
