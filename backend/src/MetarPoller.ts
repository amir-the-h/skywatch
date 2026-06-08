import type { Server } from 'socket.io';
import type { MetarData } from '../../shared/types';
import type { RedisStore } from './RedisStore';

const METAR_URL = 'https://aviationweather.gov/api/data/metar';

interface RawMetarEntry {
  icaoId: string;
  rawOb: string;
  wdir: number | 'VRB' | null;
  wspd: number;
  wgst: number | null;
  obsTime: string;
}

function parseMetarEntry(entry: unknown): { icao: string; data: MetarData } | null {
  const e = entry as RawMetarEntry;
  if (!e.icaoId) return null;
  return {
    icao: e.icaoId,
    data: {
      windDir: typeof e.wdir === 'number' ? e.wdir : null,
      windSpeed: e.wspd ?? 0,
      windGust: e.wgst ?? null,
      raw: e.rawOb ?? '',
      observedAt: e.obsTime ?? new Date().toISOString(),
    },
  };
}

export class MetarPoller {
  private socketIcaos = new Map<string, Set<string>>();
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private store: RedisStore,
    private io: Server,
    private intervalMs = 5 * 60 * 1000,
  ) {}

  start(): void {
    this.intervalId = setInterval(() => this.pollNow(), this.intervalMs);
    console.log(`[metar] Poller started (interval: ${this.intervalMs}ms)`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  addSocket(socketId: string, icaos: string[]): void {
    this.socketIcaos.set(socketId, new Set(icaos));
  }

  removeSocket(socketId: string): void {
    this.socketIcaos.delete(socketId);
  }

  allWantedIcaos(): string[] {
    const all = new Set<string>();
    for (const icaos of this.socketIcaos.values()) {
      for (const icao of icaos) all.add(icao);
    }
    return [...all];
  }

  async getMetarFor(icaos: string[]): Promise<Record<string, MetarData>> {
    return this.store.getManyMetar(icaos);
  }

  async pollNow(): Promise<void> {
    const allIcaos = this.allWantedIcaos();
    const icaos = allIcaos.filter((id) => /^[A-Z0-9]{4}$/.test(id));
    const skipped = allIcaos.length - icaos.length;
    if (skipped > 0) console.log(`[metar] Skipping ${skipped} non-standard ICAOs (e.g. ${allIcaos.filter((id) => !/^[A-Z0-9]{4}$/.test(id)).slice(0, 3).join(', ')})`);
    if (icaos.length === 0) { console.log('[metar] No valid ICAOs to poll'); return; }

    const url = `${METAR_URL}?ids=${icaos.join(',')}&format=json`;
    console.log(`[metar] Fetching ${icaos.length} ICAOs: ${icaos.join(',')}`);

    let entries: unknown[] = [];
    try {
      const res = await fetch(url);
      console.log(`[metar] Response status: ${res.status}`);
      if (res.ok) {
        const body = await res.json();
        entries = Array.isArray(body) ? body : [];
        if (!Array.isArray(body)) console.log(`[metar] Unexpected response shape: ${JSON.stringify(body).slice(0, 200)}`);
      } else {
        const text = await res.text();
        console.log(`[metar] Non-OK response: ${text.slice(0, 200)}`);
      }
    } catch (err) {
      console.log(`[metar] Fetch error: ${err}`);
    }

    for (const entry of entries) {
      const parsed = parseMetarEntry(entry);
      if (parsed) await this.store.saveMetar(parsed.icao, parsed.data);
    }

    for (const [socketId, socketIcaoSet] of this.socketIcaos) {
      const metar = await this.store.getManyMetar([...socketIcaoSet]);
      this.io.to(socketId).emit('metar_update', metar);
    }

    console.log(`[metar] Done: ${entries.length} METARs received, ${Object.keys(entries).length ? entries.length : 0} stored`);
  }
}
