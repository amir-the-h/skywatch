# Backend Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move data collection, path history, and flight phase computation to a Node.js backend; push live updates to the frontend via Socket.io; frontend becomes a pure render layer.

**Architecture:** A global `FetchQueue` fires every 1s, round-robins across active grid cells, and calls airplanes.live once per tick. `CellPoller` processes each fetch result, writes aircraft to Redis, and broadcasts filtered updates to sockets in that cell via Socket.io. The frontend connects via Socket.io, registers its location, and receives pushed `aircraft_update` events.

**Tech Stack:** Node.js 22, TypeScript, Socket.io 4, `redis` (ioredis-compatible v4 client), `tsx` runtime, Vitest, Docker Compose, `socket.io-client` on frontend.

---

## File Map

**New:**
- `shared/types.ts` — `FlightPhase`, `BackendAircraft` (used by both frontend and backend)
- `backend/package.json`
- `backend/tsconfig.json`
- `backend/vitest.config.ts`
- `backend/Dockerfile`
- `backend/src/GridEngine.ts` — grid snapping math, cell key generation
- `backend/src/GridEngine.test.ts`
- `backend/src/AircraftProcessor.ts` — `inferFlightPhase` (ported from frontend)
- `backend/src/AircraftProcessor.test.ts`
- `backend/src/RedisStore.ts` — all Redis read/write
- `backend/src/FetchQueue.ts` — global 1 req/s round-robin queue
- `backend/src/FetchQueue.test.ts`
- `backend/src/CellPoller.ts` — fetches airplanes.live, writes Redis, broadcasts
- `backend/src/server.ts` — Socket.io server, wires everything
- `src/hooks/useAircraftSocket.ts` — replaces `useAircraftFeed`

**Modified:**
- `src/types/aircraft.ts` — extend `BackendAircraft`, re-export `FlightPhase`, remove own field definitions that overlap; `refreshInterval` removed from `Settings`
- `src/lib/flightPhase.ts` — remove `inferFlightPhase`, re-export `FlightPhase` from shared, keep `getPhaseColor`
- `src/lib/labelVisibility.ts` — use `ac.phase` instead of `inferFlightPhase(ac)`
- `src/lib/aircraftFilter.ts` — use `ac.phase` instead of `inferFlightPhase(ac)`, import `FlightPhase` from shared
- `src/store/aircraftStore.ts` — `mergeAircraft` accepts `BackendAircraft[]`, uses `ac.pathHistory` directly
- `src/components/SettingsPanel/SettingsModal.tsx` — remove refresh interval UI
- `src/App.tsx` — swap `useAircraftFeed` → `useAircraftSocket`
- `docker-compose.yml` — add `redis` + `backend` services
- `package.json` (root) — add `socket.io-client`

**Deleted:**
- `src/api/airplanesLive.ts`
- `src/hooks/useAircraftFeed.ts`

---

### Task 1: Shared types

**Files:**
- Create: `shared/types.ts`

- [ ] **Step 1: Create shared types file**

```typescript
// shared/types.ts
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

- [ ] **Step 2: Commit**

```bash
git add shared/types.ts
git commit -m "feat: add shared BackendAircraft and FlightPhase types"
```

---

### Task 2: Backend scaffold

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/vitest.config.ts`

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "flight-tracker-backend",
  "version": "0.0.0",
  "type": "commonjs",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "tsx src/server.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "express": "^4.19.2",
    "socket.io": "^4.7.5",
    "redis": "^4.6.14"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.0.0",
    "tsx": "^4.15.7",
    "typescript": "^5.5.2",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `backend/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node' },
});
```

- [ ] **Step 4: Install backend dependencies**

```bash
cd backend && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: scaffold backend package"
```

---

### Task 3: GridEngine

**Files:**
- Create: `backend/src/GridEngine.ts`
- Create: `backend/src/GridEngine.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// backend/src/GridEngine.test.ts
import { describe, it, expect } from 'vitest';
import { snapToGrid, cellKey } from './GridEngine';

describe('snapToGrid', () => {
  it('returns consistent snapped coords for nearby points', () => {
    const a = snapToGrid(41.01, 28.97);
    const b = snapToGrid(41.02, 28.98);
    expect(cellKey(a.gLat, a.gLon)).toBe(cellKey(b.gLat, b.gLon));
  });

  it('returns different cell keys for distant points', () => {
    const a = snapToGrid(41.0, 28.0);
    const b = snapToGrid(42.0, 29.0);
    expect(cellKey(a.gLat, a.gLon)).not.toBe(cellKey(b.gLat, b.gLon));
  });

  it('cellKey is deterministic for same input', () => {
    const { gLat, gLon } = snapToGrid(51.5, -0.12);
    expect(cellKey(gLat, gLon)).toBe(cellKey(gLat, gLon));
  });

  it('cellKey contains no floating point noise', () => {
    const { gLat, gLon } = snapToGrid(41.0082, 28.9784);
    const key = cellKey(gLat, gLon);
    expect(key).toMatch(/^-?\d+\.\d{4}:-?\d+\.\d{4}$/);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd backend && npm test -- GridEngine
```

Expected: FAIL — `Cannot find module './GridEngine'`

- [ ] **Step 3: Implement GridEngine**

```typescript
// backend/src/GridEngine.ts
const CELL_DEG = 0.045; // ≈ 5 km

export function snapToGrid(lat: number, lon: number): { gLat: number; gLon: number } {
  return {
    gLat: Math.round(lat / CELL_DEG) * CELL_DEG,
    gLon: Math.round(lon / CELL_DEG) * CELL_DEG,
  };
}

export function cellKey(gLat: number, gLon: number): string {
  return `${gLat.toFixed(4)}:${gLon.toFixed(4)}`;
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
cd backend && npm test -- GridEngine
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/GridEngine.ts backend/src/GridEngine.test.ts
git commit -m "feat: add GridEngine with 5km cell snapping"
```

---

### Task 4: AircraftProcessor

**Files:**
- Create: `backend/src/AircraftProcessor.ts`
- Create: `backend/src/AircraftProcessor.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// backend/src/AircraftProcessor.test.ts
import { describe, it, expect } from 'vitest';
import { inferFlightPhase } from './AircraftProcessor';

describe('inferFlightPhase', () => {
  it('TXI: slow, low', () => expect(inferFlightPhase(200, 25, 0)).toBe('TXI'));
  it('GND: stationary on ground', () => expect(inferFlightPhase(0, 0, 0)).toBe('GND'));
  it('T/O: climbing hard from low alt', () => expect(inferFlightPhase(1000, 160, 1500)).toBe('T/O'));
  it('APP: descending at low alt', () => expect(inferFlightPhase(3000, 140, -500)).toBe('APP'));
  it('CLB: positive rate at altitude', () => expect(inferFlightPhase(15000, 400, 500)).toBe('CLB'));
  it('DSC: negative rate at altitude', () => expect(inferFlightPhase(15000, 400, -500)).toBe('DSC'));
  it('CRZ: level at cruise', () => expect(inferFlightPhase(35000, 450, 0)).toBe('CRZ'));
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd backend && npm test -- AircraftProcessor
```

Expected: FAIL — `Cannot find module './AircraftProcessor'`

- [ ] **Step 3: Implement AircraftProcessor**

```typescript
// backend/src/AircraftProcessor.ts
import type { FlightPhase } from '../../shared/types';

export function inferFlightPhase(alt: number, gs: number, baro_rate: number): FlightPhase {
  if (alt <= 500 && gs >= 5 && gs <= 50) return 'TXI';
  if (alt <= 500 && gs < 5) return 'GND';
  if (alt < 3000 && baro_rate > 1000) return 'T/O';
  if (alt < 5000 && baro_rate < -300) return 'APP';
  if (baro_rate > 200) return 'CLB';
  if (baro_rate < -200) return 'DSC';
  return 'CRZ';
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
cd backend && npm test -- AircraftProcessor
```

Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/AircraftProcessor.ts backend/src/AircraftProcessor.test.ts
git commit -m "feat: add AircraftProcessor with inferFlightPhase"
```

---

### Task 5: RedisStore

**Files:**
- Create: `backend/src/RedisStore.ts`

Note: no unit tests — requires live Redis. Tested via integration in Task 8.

- [ ] **Step 1: Create RedisStore**

```typescript
// backend/src/RedisStore.ts
import { createClient } from 'redis';
import type { BackendAircraft } from '../../shared/types';
import { cellKey } from './GridEngine';

type RedisClient = ReturnType<typeof createClient>;

function serializeAircraft(ac: Omit<BackendAircraft, 'pathHistory'>): Record<string, string> {
  return {
    hex: ac.hex,
    flight: ac.flight,
    r: ac.r,
    t: ac.t,
    desc: ac.desc ?? '',
    lat: String(ac.lat),
    lon: String(ac.lon),
    alt_baro: String(ac.alt_baro),
    gs: String(ac.gs),
    track: String(ac.track),
    baro_rate: String(ac.baro_rate),
    mach: ac.mach != null ? String(ac.mach) : '',
    squawk: ac.squawk ?? '',
    emergency: ac.emergency ?? '',
    nav_altitude_mcp: ac.nav_altitude_mcp != null ? String(ac.nav_altitude_mcp) : '',
    nav_heading: ac.nav_heading != null ? String(ac.nav_heading) : '',
    nav_modes: ac.nav_modes ? JSON.stringify(ac.nav_modes) : '',
    ownOp: ac.ownOp ?? '',
    year: ac.year ?? '',
    orig_iata: ac.orig_iata ?? '',
    dest_iata: ac.dest_iata ?? '',
    orig_name: ac.orig_name ?? '',
    dest_name: ac.dest_name ?? '',
    seen: String(ac.seen),
    phase: ac.phase,
  };
}

function deserializeAircraft(
  hash: Record<string, string>,
  pathHistory: { lat: number; lon: number }[]
): BackendAircraft {
  return {
    hex: hash.hex,
    flight: hash.flight,
    r: hash.r,
    t: hash.t,
    desc: hash.desc || undefined,
    lat: parseFloat(hash.lat),
    lon: parseFloat(hash.lon),
    alt_baro: parseFloat(hash.alt_baro),
    gs: parseFloat(hash.gs),
    track: parseFloat(hash.track),
    baro_rate: parseFloat(hash.baro_rate),
    mach: hash.mach ? parseFloat(hash.mach) : undefined,
    squawk: hash.squawk || undefined,
    emergency: hash.emergency || undefined,
    nav_altitude_mcp: hash.nav_altitude_mcp ? parseFloat(hash.nav_altitude_mcp) : undefined,
    nav_heading: hash.nav_heading ? parseFloat(hash.nav_heading) : undefined,
    nav_modes: hash.nav_modes ? JSON.parse(hash.nav_modes) : undefined,
    ownOp: hash.ownOp || undefined,
    year: hash.year || undefined,
    orig_iata: hash.orig_iata || undefined,
    dest_iata: hash.dest_iata || undefined,
    orig_name: hash.orig_name || undefined,
    dest_name: hash.dest_name || undefined,
    seen: parseFloat(hash.seen),
    phase: hash.phase as BackendAircraft['phase'],
    pathHistory,
  };
}

export class RedisStore {
  private client: RedisClient;

  constructor(url: string) {
    this.client = createClient({ url });
    this.client.on('error', (err) => console.error('Redis error:', err));
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async saveAircraft(ac: Omit<BackendAircraft, 'pathHistory'>): Promise<void> {
    const key = `aircraft:${ac.hex}`;
    const pathKey = `${key}:path`;

    await this.client.hSet(key, serializeAircraft(ac));
    await this.client.expire(key, 30);

    await this.client.lPush(pathKey, JSON.stringify({ lat: ac.lat, lon: ac.lon }));
    await this.client.lTrim(pathKey, 0, 49);
    await this.client.expire(pathKey, 30);
  }

  async getAircraft(hex: string): Promise<BackendAircraft | null> {
    const key = `aircraft:${hex}`;
    const pathKey = `${key}:path`;

    const [hash, rawPath] = await Promise.all([
      this.client.hGetAll(key),
      this.client.lRange(pathKey, 0, -1),
    ]);

    if (!hash.hex) return null;

    const pathHistory = rawPath
      .map((p) => JSON.parse(p) as { lat: number; lon: number })
      .reverse();

    return deserializeAircraft(hash, pathHistory);
  }

  async saveCellMeta(
    gLat: number,
    gLon: number,
    maxRadiusKm: number
  ): Promise<void> {
    const key = `cell:${cellKey(gLat, gLon)}:meta`;
    await this.client.hSet(key, {
      fetchLat: String(gLat),
      fetchLon: String(gLon),
      maxRadiusKm: String(maxRadiusKm),
    });
  }

  async saveCellHexes(gLat: number, gLon: number, hexes: string[]): Promise<void> {
    const key = `cell:${cellKey(gLat, gLon)}:hexes`;
    await this.client.del(key);
    if (hexes.length > 0) {
      await this.client.sAdd(key, hexes);
    }
  }

  async deleteCell(gLat: number, gLon: number): Promise<void> {
    const ck = cellKey(gLat, gLon);
    await this.client.del([`cell:${ck}:meta`, `cell:${ck}:hexes`]);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/RedisStore.ts
git commit -m "feat: add RedisStore for aircraft and cell persistence"
```

---

### Task 6: FetchQueue

**Files:**
- Create: `backend/src/FetchQueue.ts`
- Create: `backend/src/FetchQueue.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// backend/src/FetchQueue.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FetchQueue } from './FetchQueue';

describe('FetchQueue', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('calls fetchFn for added cell after one interval', async () => {
    const fetchFn = vi.fn().mockResolvedValue(undefined);
    const q = new FetchQueue(fetchFn, 1000);
    q.addCell('a:b');
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchFn).toHaveBeenCalledWith('a:b');
  });

  it('round-robins two cells over three ticks', async () => {
    const calls: string[] = [];
    const fetchFn = vi.fn(async (k: string) => { calls.push(k); });
    const q = new FetchQueue(fetchFn, 1000);
    q.addCell('cell1');
    q.addCell('cell2');
    await vi.advanceTimersByTimeAsync(3000);
    expect(calls).toEqual(['cell1', 'cell2', 'cell1']);
  });

  it('does not call fetchFn after cell is removed', async () => {
    const fetchFn = vi.fn().mockResolvedValue(undefined);
    const q = new FetchQueue(fetchFn, 1000);
    q.addCell('cell1');
    q.removeCell('cell1');
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('does not add duplicate cell keys', async () => {
    const fetchFn = vi.fn().mockResolvedValue(undefined);
    const q = new FetchQueue(fetchFn, 1000);
    q.addCell('cell1');
    q.addCell('cell1');
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd backend && npm test -- FetchQueue
```

Expected: FAIL — `Cannot find module './FetchQueue'`

- [ ] **Step 3: Implement FetchQueue**

```typescript
// backend/src/FetchQueue.ts
type FetchFn = (cellKey: string) => Promise<void>;

export class FetchQueue {
  private queue: string[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private fetchFn: FetchFn;
  private intervalMs: number;

  constructor(fetchFn: FetchFn, intervalMs: number) {
    this.fetchFn = fetchFn;
    this.intervalMs = intervalMs;
  }

  addCell(key: string): void {
    if (this.queue.includes(key)) return;
    this.queue.push(key);
    if (!this.timer) this.start();
  }

  removeCell(key: string): void {
    this.queue = this.queue.filter((k) => k !== key);
    if (this.queue.length === 0) this.stop();
  }

  private start(): void {
    this.timer = setInterval(() => { void this.tick(); }, this.intervalMs);
  }

  private stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.queue.length === 0) return;
    const key = this.queue.shift()!;
    this.queue.push(key);
    await this.fetchFn(key);
  }
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
cd backend && npm test -- FetchQueue
```

Expected: PASS (4 tests)

- [ ] **Step 5: Run all backend tests**

```bash
cd backend && npm test
```

Expected: PASS (11 tests total across GridEngine, AircraftProcessor, FetchQueue)

- [ ] **Step 6: Commit**

```bash
git add backend/src/FetchQueue.ts backend/src/FetchQueue.test.ts
git commit -m "feat: add FetchQueue with round-robin rate limiting"
```

---

### Task 7: CellPoller

**Files:**
- Create: `backend/src/CellPoller.ts`

- [ ] **Step 1: Create CellPoller**

```typescript
// backend/src/CellPoller.ts
import type { Server } from 'socket.io';
import type { BackendAircraft } from '../../shared/types';
import { inferFlightPhase } from './AircraftProcessor';
import { RedisStore } from './RedisStore';

const BASE = process.env.AIRPLANES_LIVE_BASE ?? 'https://api.airplanes.live/v2/point';
const KM_TO_NM = 0.539957;

interface SocketInfo {
  userLat: number;
  userLon: number;
  radiusKm: number;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeRaw(raw: any, phase: BackendAircraft['phase']): Omit<BackendAircraft, 'pathHistory'> | null {
  if (raw.lat == null || raw.lon == null) return null;
  return {
    hex: raw.hex ?? '',
    flight: (raw.flight ?? '').trim(),
    r: raw.r ?? '',
    t: raw.t ?? '',
    desc: raw.desc ?? undefined,
    lat: raw.lat,
    lon: raw.lon,
    alt_baro: typeof raw.alt_baro === 'number' ? raw.alt_baro : 0,
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
    orig_iata: raw.orig_iata ?? undefined,
    dest_iata: raw.dest_iata ?? undefined,
    orig_name: raw.orig_name ?? undefined,
    dest_name: raw.dest_name ?? undefined,
    seen: raw.seen ?? 0,
    phase,
  };
}

export async function pollCell(
  gLat: number,
  gLon: number,
  maxRadiusKm: number,
  store: RedisStore,
  io: Server,
  sockets: Map<string, SocketInfo>
): Promise<void> {
  const radiusNm = Math.round(maxRadiusKm * KM_TO_NM);
  const url = `${BASE}/${gLat}/${gLon}/${radiusNm}`;

  let rawAc: unknown[];
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json() as { ac?: unknown[] };
    rawAc = data.ac ?? [];
  } catch {
    return;
  }

  const aircraft: BackendAircraft[] = [];

  for (const raw of rawAc) {
    const phase = inferFlightPhase(
      typeof (raw as Record<string, unknown>).alt_baro === 'number'
        ? (raw as Record<string, unknown>).alt_baro as number
        : 0,
      ((raw as Record<string, unknown>).gs as number) ?? 0,
      ((raw as Record<string, unknown>).baro_rate as number) ?? 0
    );
    const normalized = normalizeRaw(raw, phase);
    if (!normalized) continue;

    await store.saveAircraft(normalized);
    const saved = await store.getAircraft(normalized.hex);
    if (saved) aircraft.push(saved);
  }

  await store.saveCellHexes(gLat, gLon, aircraft.map((a) => a.hex));

  for (const [socketId, info] of sockets) {
    const filtered = aircraft.filter(
      (ac) => haversineKm(info.userLat, info.userLon, ac.lat, ac.lon) <= info.radiusKm
    );
    io.to(socketId).emit('aircraft_update', {
      aircraft: filtered,
      cell: { lat: gLat, lon: gLon, radiusKm: info.radiusKm },
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/CellPoller.ts
git commit -m "feat: add CellPoller — fetch, process, broadcast per cell"
```

---

### Task 8: server.ts

**Files:**
- Create: `backend/src/server.ts`

- [ ] **Step 1: Create server**

```typescript
// backend/src/server.ts
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { RedisStore } from './RedisStore';
import { FetchQueue } from './FetchQueue';
import { snapToGrid, cellKey } from './GridEngine';
import { pollCell } from './CellPoller';

const PORT = parseInt(process.env.PORT ?? '3001');
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? '1000');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

const store = new RedisStore(REDIS_URL);

interface SocketInfo {
  gLat: number;
  gLon: number;
  userLat: number;
  userLon: number;
  radiusKm: number;
}

// socketId → location info
const socketMap = new Map<string, SocketInfo>();
// cellKey → { gLat, gLon, sockets: Map<socketId, { userLat, userLon, radiusKm }> }
const cellMap = new Map<
  string,
  { gLat: number; gLon: number; sockets: Map<string, { userLat: number; userLon: number; radiusKm: number }> }
>();

const queue = new FetchQueue(async (ck: string) => {
  const cell = cellMap.get(ck);
  if (!cell || cell.sockets.size === 0) return;
  const maxRadiusKm = Math.max(...[...cell.sockets.values()].map((s) => s.radiusKm));
  await pollCell(cell.gLat, cell.gLon, maxRadiusKm, store, io, cell.sockets);
}, POLL_INTERVAL_MS);

async function registerSocket(
  socketId: string,
  userLat: number,
  userLon: number,
  radiusKm: number
): Promise<void> {
  const { gLat, gLon } = snapToGrid(userLat, userLon);
  const ck = cellKey(gLat, gLon);

  socketMap.set(socketId, { gLat, gLon, userLat, userLon, radiusKm });

  if (!cellMap.has(ck)) {
    cellMap.set(ck, { gLat, gLon, sockets: new Map() });
  }
  cellMap.get(ck)!.sockets.set(socketId, { userLat, userLon, radiusKm });

  const maxRadiusKm = Math.max(
    ...[...cellMap.get(ck)!.sockets.values()].map((s) => s.radiusKm)
  );
  await store.saveCellMeta(gLat, gLon, maxRadiusKm);
  queue.addCell(ck);
}

async function unregisterSocket(socketId: string): Promise<void> {
  const info = socketMap.get(socketId);
  if (!info) return;

  const ck = cellKey(info.gLat, info.gLon);
  const cell = cellMap.get(ck);
  if (cell) {
    cell.sockets.delete(socketId);
    if (cell.sockets.size === 0) {
      cellMap.delete(ck);
      queue.removeCell(ck);
      await store.deleteCell(info.gLat, info.gLon);
    } else {
      const maxRadiusKm = Math.max(...[...cell.sockets.values()].map((s) => s.radiusKm));
      await store.saveCellMeta(info.gLat, info.gLon, maxRadiusKm);
    }
  }
  socketMap.delete(socketId);
}

io.on('connection', (socket) => {
  socket.on(
    'register_location',
    async ({ lat, lon, radiusKm }: { lat: number; lon: number; radiusKm: number }) => {
      const existing = socketMap.get(socket.id);
      if (existing) {
        const { gLat: newGLat, gLon: newGLon } = snapToGrid(lat, lon);
        if (existing.gLat !== newGLat || existing.gLon !== newGLon) {
          await unregisterSocket(socket.id);
        } else {
          // Same cell — update radius only
          const ck = cellKey(existing.gLat, existing.gLon);
          const cell = cellMap.get(ck);
          if (cell) {
            cell.sockets.set(socket.id, { userLat: lat, userLon: lon, radiusKm });
            socketMap.set(socket.id, { ...existing, userLat: lat, userLon: lon, radiusKm });
            const maxRadiusKm = Math.max(...[...cell.sockets.values()].map((s) => s.radiusKm));
            await store.saveCellMeta(existing.gLat, existing.gLon, maxRadiusKm);
          }
          return;
        }
      }
      await registerSocket(socket.id, lat, lon, radiusKm);
    }
  );

  socket.on('disconnect', async () => {
    await unregisterSocket(socket.id);
  });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

async function main() {
  await store.connect();
  httpServer.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });
}

main().catch(console.error);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/server.ts
git commit -m "feat: add Socket.io server with cell lifecycle and FetchQueue wiring"
```

---

### Task 9: Docker setup

**Files:**
- Create: `backend/Dockerfile`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Create `backend/Dockerfile`**

Build context must be the repo root (set in docker-compose) so the Dockerfile can access `shared/`.

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY shared/ ./shared/
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev
COPY backend/src/ ./src/
CMD ["npx", "tsx", "src/server.ts"]
```

- [ ] **Step 2: Update the root `Dockerfile` to accept `VITE_BACKEND_URL` as a build arg**

Vite bakes env vars into the bundle at build time, so this arg must be passed during `docker build`. Find the `RUN npm run build` line and add the ARG before it:

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_BACKEND_URL=http://localhost:3001
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 3: Create/replace `docker-compose.yml`**

```yaml
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped

  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    restart: unless-stopped
    environment:
      REDIS_URL: redis://redis:6379
      POLL_INTERVAL_MS: "1000"
      AIRPLANES_LIVE_BASE: https://api.airplanes.live/v2/point
      PORT: "3001"
    depends_on:
      - redis

  frontend:
    build:
      context: .
      args:
        VITE_BACKEND_URL: https://skywatch.the-h.me
    restart: unless-stopped
    depends_on:
      - backend
```

- [ ] **Step 3: Verify backend Docker image builds**

```bash
docker compose build backend
```

Expected: build succeeds, no errors

- [ ] **Step 4: Commit**

```bash
git add backend/Dockerfile Dockerfile docker-compose.yml
git commit -m "feat: add backend Dockerfile and docker-compose services"
```

---

### Task 10: Frontend — shared types + Aircraft type migration

**Files:**
- Modify: `src/types/aircraft.ts`
- Modify: `src/lib/flightPhase.ts`

- [ ] **Step 1: Update `src/lib/flightPhase.ts` — remove `inferFlightPhase`, re-export `FlightPhase` from shared**

Replace the entire file:

```typescript
// src/lib/flightPhase.ts
export type { FlightPhase } from '../../shared/types';

export function getPhaseColor(phase: string): string {
  switch (phase) {
    case 'CLB':
    case 'T/O':
      return '#4ade80';
    case 'DSC':
    case 'APP':
      return '#f87171';
    default:
      return '#9ca3af';
  }
}
```

- [ ] **Step 2: Update `src/types/aircraft.ts` — extend BackendAircraft, remove duplicate fields**

Replace the Aircraft interface and FlightPhase type (keep Settings, LabelCondition, DEFAULT_SETTINGS):

```typescript
// src/types/aircraft.ts
import type { BackendAircraft } from '../../shared/types';
export type { FlightPhase } from '../../shared/types';

export type LabelCondition = 'always' | 'airport' | 'emergency' | 'pinned';

export interface Aircraft extends BackendAircraft {
  _renderLat: number;
  _renderLon: number;
  _lastSeen: number;
}

export interface Settings {
  lat: number;
  lng: number;
  radiusKm: number;
  theme: 'dark' | 'light';
  tileSource: 'osm' | 'satellite';
  view: 'map' | 'radar';
  ringIntervals: number[];
  trailLength: number;
  labelConditions: LabelCondition[];
  showAirports: boolean;
  airportTypes: ('large_airport' | 'medium_airport' | 'small_airport')[];
}

export const DEFAULT_SETTINGS: Settings = {
  lat: 41.0082,
  lng: 28.9784,
  radiusKm: 150,
  theme: 'dark',
  tileSource: 'osm',
  view: 'map',
  ringIntervals: [25, 50, 100, 150],
  trailLength: 50,
  labelConditions: ['always'],
  showAirports: true,
  airportTypes: ['large_airport', 'medium_airport'],
};
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected errors at this point (will be fixed in later tasks):
- `inferFlightPhase` callers in `labelVisibility.ts`, `aircraftFilter.ts`, `RadarCanvas.ts` — fixed in Task 11
- `refreshInterval` in `SettingsModal.tsx` — fixed in Task 14

If any other unexpected errors appear, fix them before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/types/aircraft.ts src/lib/flightPhase.ts
git commit -m "refactor: Aircraft extends BackendAircraft; FlightPhase from shared"
```

---

### Task 11: Frontend — replace `inferFlightPhase` with `ac.phase`

**Files:**
- Modify: `src/lib/labelVisibility.ts`
- Modify: `src/lib/aircraftFilter.ts`
- Modify: `src/components/RadarView/RadarCanvas.ts`

- [ ] **Step 1: Update `src/lib/labelVisibility.ts`**

```typescript
// src/lib/labelVisibility.ts
import type { Aircraft, LabelCondition } from '../types/aircraft';

const AIRPORT_PHASES = new Set(['TXI', 'GND', 'T/O', 'APP']);
const EMERGENCY_SQUAWKS = new Set(['7500', '7600', '7700']);

export function shouldShowLabel(
  ac: Aircraft,
  pinnedHexes: Set<string>,
  conditions: LabelCondition[]
): boolean {
  if (conditions.includes('always')) return true;
  if (conditions.includes('airport') && AIRPORT_PHASES.has(ac.phase)) return true;
  if (conditions.includes('emergency')) {
    const sq = ac.squawk ?? '';
    const em = ac.emergency ?? '';
    if (EMERGENCY_SQUAWKS.has(sq) || (em !== '' && em !== 'none')) return true;
  }
  if (conditions.includes('pinned') && pinnedHexes.has(ac.hex)) return true;
  return false;
}
```

- [ ] **Step 2: Update `src/lib/aircraftFilter.ts`**

```typescript
// src/lib/aircraftFilter.ts
import type { Aircraft } from '../types/aircraft';
import type { FlightPhase } from '../../shared/types';

export interface FilterCriteria {
  callsigns: string[];
  altMin: number;
  altMax: number;
  phases: FlightPhase[];
  manufacturers: string[];
  models: string[];
}

export function matchesFilter(ac: Aircraft, filters: FilterCriteria): boolean {
  if (filters.callsigns.length > 0 && !filters.callsigns.includes(ac.flight ?? '')) return false;
  if (ac.alt_baro < filters.altMin || ac.alt_baro > filters.altMax) return false;
  if (filters.phases.length > 0 && !filters.phases.includes(ac.phase)) return false;
  if (filters.manufacturers.length > 0 && !filters.manufacturers.includes(ac.desc ?? '')) return false;
  if (filters.models.length > 0 && !filters.models.includes(ac.t ?? '')) return false;
  return true;
}
```

- [ ] **Step 3: Update `src/components/RadarView/RadarCanvas.ts`** — remove `inferFlightPhase` import and call

Find lines:
```typescript
import { inferFlightPhase, getPhaseColor } from '../../lib/flightPhase';
```
Replace with:
```typescript
import { getPhaseColor } from '../../lib/flightPhase';
```

Find:
```typescript
    const phase = inferFlightPhase(ac);
    const phaseColor = getPhaseColor(phase);
```
Replace with:
```typescript
    const phaseColor = getPhaseColor(ac.phase);
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no more `inferFlightPhase` errors. If new errors appear, fix them.

- [ ] **Step 5: Run frontend tests**

```bash
npm test
```

Expected: all pass (flightPhase.test.ts will now fail since `inferFlightPhase` is removed — delete that test file)

```bash
rm src/lib/flightPhase.test.ts
npm test
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/labelVisibility.ts src/lib/aircraftFilter.ts src/components/RadarView/RadarCanvas.ts
git rm src/lib/flightPhase.test.ts
git commit -m "refactor: use ac.phase from backend instead of inferring on frontend"
```

---

### Task 12: Frontend — update aircraftStore

**Files:**
- Modify: `src/store/aircraftStore.ts`

- [ ] **Step 1: Update `mergeAircraft` to accept `BackendAircraft[]` and use incoming `pathHistory`**

Replace the entire file:

```typescript
// src/store/aircraftStore.ts
import { create } from 'zustand';
import type { Aircraft } from '../types/aircraft';
import type { BackendAircraft } from '../../shared/types';
import { interpolatePosition } from '../lib/interpolate';

interface AircraftStore {
  aircraft: Map<string, Aircraft>;
  pathHistory: Map<string, { lat: number; lon: number }[]>;
  pinnedHexes: Set<string>;
  hoveredHex: string | null;
  lastUpdated: number | null;

  mergeAircraft: (incoming: BackendAircraft[]) => void;
  removeStale: (hexes: Set<string>) => void;
  pin: (hex: string) => void;
  unpin: (hex: string) => void;
  setHovered: (hex: string | null) => void;
}

export const useAircraftStore = create<AircraftStore>((set) => ({
  aircraft: new Map(),
  pathHistory: new Map(),
  pinnedHexes: new Set(),
  hoveredHex: null,
  lastUpdated: null,

  mergeAircraft: (incoming) =>
    set((state) => {
      const next = new Map(state.aircraft);
      const nextHistory = new Map(state.pathHistory);
      const now = Date.now();
      for (const ac of incoming) {
        const prev = next.get(ac.hex);
        const advanced = prev ? interpolatePosition(prev, now) : null;
        next.set(ac.hex, {
          ...ac,
          _renderLat: advanced ? advanced._renderLat : ac.lat,
          _renderLon: advanced ? advanced._renderLon : ac.lon,
          _lastSeen: now,
        });
        nextHistory.set(ac.hex, ac.pathHistory);
      }
      return { aircraft: next, pathHistory: nextHistory, lastUpdated: now };
    }),

  removeStale: (activeHexes) =>
    set((state) => {
      const next = new Map(state.aircraft);
      const nextHistory = new Map(state.pathHistory);
      for (const hex of next.keys()) {
        if (!activeHexes.has(hex)) {
          next.delete(hex);
          nextHistory.delete(hex);
        }
      }
      const newPinned = new Set([...state.pinnedHexes].filter((h) => next.has(h)));
      return { aircraft: next, pathHistory: nextHistory, pinnedHexes: newPinned };
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

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run frontend tests**

```bash
npm test
```

Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add src/store/aircraftStore.ts
git commit -m "refactor: aircraftStore accepts BackendAircraft, uses backend pathHistory"
```

---

### Task 13: Frontend — useAircraftSocket hook

**Files:**
- Create: `src/hooks/useAircraftSocket.ts`
- Add `socket.io-client` to root `package.json`

- [ ] **Step 1: Install socket.io-client**

```bash
npm install socket.io-client
```

- [ ] **Step 2: Create `src/hooks/useAircraftSocket.ts`**

```typescript
// src/hooks/useAircraftSocket.ts
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useSettingsStore } from './useSettings';
import { useAircraftStore } from '../store/aircraftStore';
import type { BackendAircraft } from '../../shared/types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001';

export function useAircraftSocket() {
  const { lat, lng, radiusKm } = useSettingsStore();
  const { mergeAircraft, removeStale } = useAircraftStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(BACKEND_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      const { lat: l, lng: ln, radiusKm: r } = useSettingsStore.getState();
      socket.emit('register_location', { lat: l, lon: ln, radiusKm: r });
    });

    socket.on('aircraft_update', ({ aircraft }: { aircraft: BackendAircraft[] }) => {
      mergeAircraft(aircraft);
      removeStale(new Set(aircraft.map((a) => a.hex)));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [mergeAircraft, removeStale]);

  useEffect(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('register_location', { lat, lon: lng, radiusKm });
    }
  }, [lat, lng, radiusKm]);
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAircraftSocket.ts package.json package-lock.json
git commit -m "feat: add useAircraftSocket hook with Socket.io connection"
```

---

### Task 14: Frontend — cleanup and wire up

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/SettingsPanel/SettingsModal.tsx`
- Delete: `src/api/airplanesLive.ts`
- Delete: `src/hooks/useAircraftFeed.ts`

- [ ] **Step 1: Update `src/App.tsx` — swap hook**

Replace:
```typescript
import { useAircraftFeed } from './hooks/useAircraftFeed';
```
With:
```typescript
import { useAircraftSocket } from './hooks/useAircraftSocket';
```

Replace:
```typescript
  useAircraftFeed();
```
With:
```typescript
  useAircraftSocket();
```

- [ ] **Step 2: Update `src/components/SettingsPanel/SettingsModal.tsx` — remove refreshInterval**

Remove the entire `<label>` block for refresh interval (lines containing `Refresh interval` and the range input and `{settings.refreshInterval}s`):

```tsx
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
```

Also update the trail length display label — it currently shows estimated minutes using `refreshInterval`. Replace:
```tsx
              {settings.trailLength === 0
                ? 'Hidden'
                : `${settings.trailLength} pts · ≈${Math.round(settings.trailLength * settings.refreshInterval / 60)} min`}
```
With:
```tsx
              {settings.trailLength === 0
                ? 'Hidden'
                : `${settings.trailLength} pts`}
```

- [ ] **Step 3: Delete old files**

```bash
git rm src/api/airplanesLive.ts src/hooks/useAircraftFeed.ts
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Run all frontend tests**

```bash
npm test
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/SettingsPanel/SettingsModal.tsx
git commit -m "feat: wire frontend to Socket.io backend; remove polling and refreshInterval"
```

---

### Task 15: End-to-end smoke test

- [ ] **Step 1: Start Redis and backend locally for testing**

```bash
docker run -d --name redis-test -p 6379:6379 redis:7-alpine
cd backend && REDIS_URL=redis://localhost:6379 npm run dev
```

Expected: `Backend listening on port 3001`

- [ ] **Step 2: Start frontend dev server**

```bash
# in a second terminal, from repo root
VITE_BACKEND_URL=http://localhost:3001 npm run dev
```

Expected: Vite starts on `http://localhost:5173`

- [ ] **Step 3: Open browser and verify**

1. Open `http://localhost:5173`
2. Open browser DevTools → Network → WS tab
3. Confirm WebSocket connection to `localhost:3001` is established
4. Confirm `register_location` event is sent on connect
5. Wait up to 5 seconds — confirm `aircraft_update` event is received with aircraft data
6. Confirm aircraft appear on the map/radar view

- [ ] **Step 4: Verify settings change triggers re-registration**

1. Open Settings modal
2. Change Radius value
3. Confirm a new `register_location` event is emitted (visible in DevTools WS tab)

- [ ] **Step 5: Stop local test containers**

```bash
docker stop redis-test && docker rm redis-test
```

- [ ] **Step 6: Final commit (if any last-minute fixes)**

```bash
git add -p
git commit -m "fix: smoke test corrections"
```

---

## Notes

- `tsx` is used at runtime in the backend Docker image — no compilation step needed, simplifying the Dockerfile.
- The build context for the backend Docker image is the repo root (set in `docker-compose.yml`) so the Dockerfile can `COPY shared/`.
- NPM reverse proxy (Nginx Proxy Manager) needs one proxy host: `skywatch.the-h.me` → `frontend:80`, and a second proxy host (or location rule) for `skywatch.the-h.me/socket.io` → `backend:3001` with WebSocket support enabled.
- `VITE_BACKEND_URL` must be set to `https://skywatch.the-h.me` in the frontend's Docker build args or `.env.production` file for the Socket.io client to connect through the domain.
