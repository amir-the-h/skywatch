import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import * as path from 'path';
import type { Airport } from '../../shared/types';
import type { RedisStore } from './RedisStore';

const AIRPORTS_PATH =
  process.env.AIRPORTS_JSON_PATH ?? path.resolve(__dirname, '../airports.json');

export async function loadAirports(store: RedisStore): Promise<void> {
  const raw = await fs.readFile(AIRPORTS_PATH, 'utf-8');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');

  const existingHash = await store.getAirportsHash();
  if (existingHash === hash) {
    console.log('[airports] Redis already up to date, skipping load');
    return;
  }

  const airports: Airport[] = JSON.parse(raw);
  console.log(`[airports] Loading ${airports.length} airports into Redis...`);

  await store.saveAllAirports(airports);
  await store.saveAirportIcaos(airports.map((a) => a.icao));
  await store.setAirportsHash(hash); // set LAST — integrity guarantee

  console.log(`[airports] Done. ${airports.length} airports loaded.`);
}
