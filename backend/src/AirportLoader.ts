import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import * as path from 'path';
import type { Airport } from '../../shared/types';
import type { RedisStore } from './RedisStore';

// The Docker image copies airports.json next to src/; in a repo checkout it
// lives in the frontend's public/ directory.
const DOCKER_AIRPORTS_PATH = path.resolve(__dirname, '../airports.json');
const REPO_AIRPORTS_PATH = path.resolve(__dirname, '../../public/airports.json');
const AIRPORTS_PATH =
  process.env.AIRPORTS_JSON_PATH ??
  (existsSync(DOCKER_AIRPORTS_PATH) ? DOCKER_AIRPORTS_PATH : REPO_AIRPORTS_PATH);

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
