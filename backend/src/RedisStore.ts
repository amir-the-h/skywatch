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
