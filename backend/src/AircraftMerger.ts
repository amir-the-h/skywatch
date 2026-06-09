import type { BackendAircraft } from '../../shared/types';

export type NormalizedAircraft = Omit<BackendAircraft, 'pathHistory'>;

const STICKY_FIELDS = [
  'flight', 'r', 't', 'desc', 'ownOp', 'year',
  'orig_iata', 'dest_iata', 'orig_name', 'dest_name',
] as const satisfies ReadonlyArray<keyof NormalizedAircraft>;

export function mergeAircraftSources(
  sources: Array<{ priority: number; aircraft: NormalizedAircraft[] }>
): NormalizedAircraft[] {
  const byHex = new Map<string, Array<{ priority: number; ac: NormalizedAircraft }>>();

  for (const { priority, aircraft } of sources) {
    const seenInSource = new Set<string>();
    for (const ac of aircraft) {
      if (seenInSource.has(ac.hex)) continue;
      seenInSource.add(ac.hex);
      const entry = byHex.get(ac.hex);
      if (entry) {
        entry.push({ priority, ac });
      } else {
        byHex.set(ac.hex, [{ priority, ac }]);
      }
    }
  }

  const results: NormalizedAircraft[] = [];

  for (const candidates of byHex.values()) {
    // Sort ascending — index 0 is the highest-priority source
    candidates.sort((a, b) => a.priority - b.priority);

    // Live fields: always take from the highest-priority source
    const merged: NormalizedAircraft = { ...candidates[0].ac };

    // Sticky fields: scan in priority order and use the first non-empty value
    for (const field of STICKY_FIELDS) {
      if (!merged[field]) {
        for (const { ac } of candidates.slice(1)) {
          if (ac[field]) {
            (merged as Record<string, unknown>)[field] = ac[field];
            break;
          }
        }
      }
    }

    results.push(merged);
  }

  return results;
}
