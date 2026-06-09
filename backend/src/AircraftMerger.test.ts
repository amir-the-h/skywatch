import { describe, it, expect } from 'vitest';
import { mergeAircraftSources, type NormalizedAircraft } from './AircraftMerger';

const makeAc = (hex: string, overrides: Partial<NormalizedAircraft> = {}): NormalizedAircraft => ({
  hex,
  flight: 'FL001',
  r: 'N12345',
  t: 'B738',
  lat: 34.0,
  lon: -118.0,
  alt_baro: 35000,
  gs: 450,
  track: 270,
  baro_rate: 0,
  seen: 1,
  phase: 'CRZ',
  ...overrides,
});

describe('mergeAircraftSources', () => {
  it('empty sources list returns empty array', () => {
    expect(mergeAircraftSources([])).toEqual([]);
  });

  it('single source: passes through all aircraft unchanged', () => {
    const ac = makeAc('abc1');
    const result = mergeAircraftSources([{ priority: 0, aircraft: [ac] }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(ac);
  });

  it('two sources, same aircraft: live fields taken from priority-0 source', () => {
    const ac0 = makeAc('abc1', { alt_baro: 35000, gs: 450 });
    const ac1 = makeAc('abc1', { alt_baro: 34800, gs: 440 });
    const result = mergeAircraftSources([
      { priority: 0, aircraft: [ac0] },
      { priority: 1, aircraft: [ac1] },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].alt_baro).toBe(35000);
    expect(result[0].gs).toBe(450);
  });

  it('desc empty in priority-0 but non-empty in priority-1: uses priority-1 value', () => {
    const ac0 = makeAc('abc1', { desc: undefined });
    const ac1 = makeAc('abc1', { desc: 'Boeing 737-800' });
    const result = mergeAircraftSources([
      { priority: 0, aircraft: [ac0] },
      { priority: 1, aircraft: [ac1] },
    ]);
    expect(result[0].desc).toBe('Boeing 737-800');
  });

  it('flight empty in priority-0 but non-empty in priority-1: uses priority-1 value', () => {
    const ac0 = makeAc('abc1', { flight: '' });
    const ac1 = makeAc('abc1', { flight: 'TK123' });
    const result = mergeAircraftSources([
      { priority: 0, aircraft: [ac0] },
      { priority: 1, aircraft: [ac1] },
    ]);
    expect(result[0].flight).toBe('TK123');
  });

  it('aircraft present in only one source is included in output', () => {
    const ac0 = makeAc('only-in-src0');
    const ac1 = makeAc('only-in-src1');
    const result = mergeAircraftSources([
      { priority: 0, aircraft: [ac0] },
      { priority: 1, aircraft: [ac1] },
    ]);
    expect(result).toHaveLength(2);
    const hexes = result.map((a) => a.hex);
    expect(hexes).toContain('only-in-src0');
    expect(hexes).toContain('only-in-src1');
  });

  it('desc absent from all sources: desc is undefined in merged output', () => {
    const ac0 = makeAc('abc1', { desc: undefined });
    const ac1 = makeAc('abc1', { desc: undefined });
    const result = mergeAircraftSources([
      { priority: 0, aircraft: [ac0] },
      { priority: 1, aircraft: [ac1] },
    ]);
    expect(result[0].desc).toBeUndefined();
  });
});
