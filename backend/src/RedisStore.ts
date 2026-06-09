// backend/src/RedisStore.ts
import { createClient } from 'redis';
import type { Airport, BackendAircraft, MetarData, EmergencyAircraft } from '../../shared/types';
import { cellKey } from './GridEngine';

type RedisClient = ReturnType<typeof createClient>;

function serializeAircraft(ac: Omit<BackendAircraft, 'pathHistory'>): Record<string, string> {
  return {
    hex: ac.hex,
    ...(ac.flight ? { flight: ac.flight } : {}),
    ...(ac.r ? { r: ac.r } : {}),
    ...(ac.t ? { t: ac.t } : {}),
    ...(ac.desc ? { desc: ac.desc } : {}),
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
    ...(ac.ownOp ? { ownOp: ac.ownOp } : {}),
    ...(ac.year ? { year: ac.year } : {}),
    ...(ac.orig_iata ? { orig_iata: ac.orig_iata } : {}),
    ...(ac.dest_iata ? { dest_iata: ac.dest_iata } : {}),
    ...(ac.orig_name ? { orig_name: ac.orig_name } : {}),
    ...(ac.dest_name ? { dest_name: ac.dest_name } : {}),
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
      .flatMap((p) => {
        try { return [JSON.parse(p) as { lat: number; lon: number }]; }
        catch { return []; }
      })
      .reverse();

    return deserializeAircraft(hash, pathHistory);
  }

  async getPathHistory(hex: string): Promise<{ lat: number; lon: number }[]> {
    const rawPath = await this.client.lRange(`aircraft:${hex}:path`, 0, -1);
    return rawPath
      .flatMap((p) => {
        try { return [JSON.parse(p) as { lat: number; lon: number }]; }
        catch { return []; }
      })
      .reverse();
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
    await this.client.expire(key, 120);
  }

  async saveCellHexes(gLat: number, gLon: number, hexes: string[]): Promise<void> {
    const key = `cell:${cellKey(gLat, gLon)}:hexes`;
    await this.client.del(key);
    if (hexes.length > 0) {
      await this.client.sAdd(key, hexes);
    }
    await this.client.expire(key, 120);
  }

  async deleteCell(gLat: number, gLon: number): Promise<void> {
    const ck = cellKey(gLat, gLon);
    await this.client.del([`cell:${ck}:meta`, `cell:${ck}:hexes`]);
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async saveAllAirports(airports: Airport[]): Promise<void> {
    if (airports.length === 0) return;
    const pipe = this.client.multi();
    for (const ap of airports) {
      pipe.set(`airport:${ap.icao}`, JSON.stringify(ap));
    }
    await pipe.exec();
  }

  async saveAirportIcaos(icaos: string[]): Promise<void> {
    await this.client.sAdd('airports:icaos', icaos);
  }

  async setAirportsHash(hash: string): Promise<void> {
    await this.client.set('airports:hash', hash);
  }

  async getAirportsHash(): Promise<string | null> {
    return this.client.get('airports:hash');
  }

  async airportsInRadius(lat: number, lon: number, km: number): Promise<Airport[]> {
    const icaos = await this.client.sMembers('airports:icaos');
    if (icaos.length === 0) return [];
    const keys = icaos.map((icao: string) => `airport:${icao}`);
    const values = await this.client.mGet(keys);
    const result: Airport[] = [];
    for (const v of values) {
      if (!v) continue;
      try {
        const ap: Airport = JSON.parse(v as string);
        if (this.haversineKm(lat, lon, ap.lat, ap.lon) <= km) result.push(ap);
      } catch { /* skip malformed */ }
    }
    return result;
  }

  async saveMetar(icao: string, data: MetarData): Promise<void> {
    await this.client.set(`metar:${icao}`, JSON.stringify(data), { EX: 600 });
  }

  async getManyMetar(icaos: string[]): Promise<Record<string, MetarData>> {
    if (icaos.length === 0) return {};
    const keys = icaos.map((icao) => `metar:${icao}`);
    const values = await this.client.mGet(keys);
    const result: Record<string, MetarData> = {};
    for (let i = 0; i < icaos.length; i++) {
      const v = values[i];
      if (!v) continue;
      try { result[icaos[i]] = JSON.parse(v as string); } catch { /* skip */ }
    }
    return result;
  }

  async saveEmergencySnapshot(aircraft: EmergencyAircraft[]): Promise<void> {
    await this.client.set('emergency:snapshot', JSON.stringify(aircraft), { EX: 90 });
  }

  async getEmergencySnapshot(): Promise<EmergencyAircraft[]> {
    const raw = await this.client.get('emergency:snapshot');
    if (!raw) return [];
    return JSON.parse(raw) as EmergencyAircraft[];
  }
}
