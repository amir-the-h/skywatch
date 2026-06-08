// backend/src/CellPoller.ts
import type { Server } from 'socket.io';
import type { BackendAircraft } from '../../shared/types';
import { inferFlightPhase } from './AircraftProcessor';
import { RedisStore } from './RedisStore';

const DEFAULT_SOURCES = [
  'https://api.airplanes.live/v2/point',
  'https://api.adsb.lol/v2/point',
];

// ADS_SOURCES: comma-separated list of ADS-B V2-compatible base URLs.
// Example: ADS_SOURCES=https://api.airplanes.live/v2/point,https://api.adsb.lol/v2/point
const SOURCES: string[] = process.env.ADS_SOURCES
  ? process.env.ADS_SOURCES.split(',').map((s) => s.trim()).filter(Boolean)
  : DEFAULT_SOURCES;

// Log a summary line every N polls per cell (default 30 ≈ every 30s at 1s poll interval).
const LOG_POLL_INTERVAL = parseInt(process.env.LOG_POLL_INTERVAL ?? '30');
const pollCounters = new Map<string, number>();

console.log(`[sources] ${SOURCES.length} ADS-B source(s) configured:`);
SOURCES.forEach((s, i) => console.log(`  [${i + 1}] ${s}`));

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

  const results = await Promise.allSettled(
    SOURCES.map((base) =>
      fetch(`${base}/${gLat}/${gLon}/${radiusNm}`)
        .then((res) => (res.ok ? (res.json() as Promise<{ ac?: unknown[] }>) : Promise.resolve({ ac: [] })))
        .then((data) => data.ac ?? [])
        .catch(() => [] as unknown[])
    )
  );

  // Merge all sources; for duplicate hex codes keep the fresher record (lower `seen` = more recent).
  const merged = new Map<string, unknown>();
  const sourceCounts: number[] = [];
  for (const result of results) {
    if (result.status !== 'fulfilled') { sourceCounts.push(0); continue; }
    sourceCounts.push(result.value.length);
    for (const raw of result.value) {
      const r = raw as Record<string, unknown>;
      const hex = r.hex as string;
      if (!hex) continue;
      const existing = merged.get(hex) as Record<string, unknown> | undefined;
      if (!existing || (r.seen as number ?? Infinity) < (existing.seen as number ?? Infinity)) {
        merged.set(hex, raw);
      }
    }
  }

  const rawAc = [...merged.values()];
  const ck = `${gLat}:${gLon}`;
  const count = (pollCounters.get(ck) ?? 0) + 1;
  pollCounters.set(ck, count);
  if (count % LOG_POLL_INTERVAL === 1) {
    const srcSummary = sourceCounts.join('+');
    console.log(`[poll] cell ${ck} | sources: ${srcSummary} raw → ${rawAc.length} merged | sockets: ${sockets.size}`);
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
