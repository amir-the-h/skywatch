// backend/src/EmergencyPoller.ts
import type { Server } from 'socket.io';
import type { EmergencyAircraft } from '../../shared/types';
import { normalizeRaw } from './normalize';
import { inferFlightPhase } from './AircraftProcessor';
import type { RedisStore } from './RedisStore';
import { rateLimiter } from './RateLimiter';

const rawSources =
  process.env.ADS_SOURCES ?? process.env.ADS_SOURCE ?? 'https://api.airplanes.live/v2/point';

const EMERGENCY_POLL_INTERVAL_MS = parseInt(process.env.EMERGENCY_POLL_INTERVAL_MS ?? '10000');

// Emergency data is global — only the primary source is needed.
// 'https://api.airplanes.live/v2/point' → 'https://api.airplanes.live/v2'
const SQUAWK_BASE: string = rawSources
  .split(',')[0]
  .trim()
  .replace(/\/[^/]+$/, '');

export class EmergencyPoller {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private store: RedisStore,
    private io: Server,
  ) {}

  start(): void {
    void this.pollNow();
    this.timer = setInterval(() => void this.pollNow(), EMERGENCY_POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async getSnapshot(): Promise<EmergencyAircraft[]> {
    return this.store.getEmergencySnapshot();
  }

  async pollNow(): Promise<void> {
    const results = await Promise.all(
      ['7500', '7600', '7700'].map((code) => this.fetchSquawk(SQUAWK_BASE, code))
    );

    const seen = new Set<string>();
    const merged: EmergencyAircraft[] = [];
    for (const ac of results.flat()) {
      if (seen.has(ac.hex)) continue;
      seen.add(ac.hex);
      merged.push(ac);
    }

    console.log(`[emergency] ${merged.length} aircraft in emergency`);
    await this.store.saveEmergencySnapshot(merged);
    this.io.emit('emergency_update', merged);
  }

  private async fetchSquawk(base: string, code: string): Promise<EmergencyAircraft[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await rateLimiter.schedule(() =>
        fetch(`${base}/squawk/${code}`, {
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        })
      );
      if (!res.ok) {
        console.error(`[emergency] ${base} squawk=${code} HTTP ${res.status}`);
        return [];
      }
      const data = (await res.json()) as { ac?: unknown[] };
      const result: EmergencyAircraft[] = [];
      for (const raw of data.ac ?? []) {
        const r = raw as Record<string, unknown>;
        const phase = inferFlightPhase(
          typeof r.alt_baro === 'number' ? r.alt_baro : 0,
          (r.gs as number) ?? 0,
          (r.baro_rate as number) ?? 0,
        );
        const normalized = normalizeRaw(r, phase);
        if (!normalized) continue;
        result.push({
          hex: normalized.hex,
          flight: normalized.flight,
          r: normalized.r,
          squawk: normalized.squawk,
          emergency: normalized.emergency,
          lat: normalized.lat,
          lon: normalized.lon,
          alt_baro: normalized.alt_baro,
          gs: normalized.gs,
          track: normalized.track,
        });
      }
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[emergency] ${base} squawk=${code} error: ${msg}`);
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
}
