import { describe, it, expect } from 'vitest';
import { interpolatePosition } from './interpolate';
import type { Aircraft } from '../types/aircraft';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return {
    hex: 'abc123',
    flight: 'TST1',
    r: 'N123AB',
    t: 'B738',
    lat: 41.0,
    lon: 28.0,
    alt_baro: 35000,
    gs: 450,
    track: 90,
    baro_rate: 0,
    seen: 0,
    _renderLat: 41.0,
    _renderLon: 28.0,
    _lastSeen: 1000,
    ...overrides,
  };
}

describe('interpolatePosition', () => {
  it('does not move aircraft with 0 ground speed', () => {
    const ac = makeAircraft({ gs: 0 });
    const result = interpolatePosition(ac, 2000);
    expect(result._renderLat).toBeCloseTo(41.0, 5);
    expect(result._renderLon).toBeCloseTo(28.0, 5);
  });

  it('moves aircraft eastward when heading is 90°', () => {
    const ac = makeAircraft({ track: 90, gs: 450 });
    const result = interpolatePosition(ac, 2000); // 1 second elapsed
    expect(result._renderLon).toBeGreaterThan(28.0);
    expect(result._renderLat).toBeCloseTo(41.0, 3);
  });

  it('caps interpolation at 10 seconds', () => {
    const ac = makeAircraft({ track: 0, gs: 450 });
    const result10 = interpolatePosition(ac, 11000); // 10s elapsed
    const result20 = interpolatePosition(ac, 21000); // 20s elapsed — capped at 10s
    expect(result10._renderLat).toBeCloseTo(result20._renderLat, 5);
  });

  it('does not move if elapsed time is negative', () => {
    const ac = makeAircraft({ track: 90, gs: 450 });
    const result = interpolatePosition(ac, 500); // _lastSeen=1000, so -500ms
    expect(result._renderLat).toBeCloseTo(41.0, 5);
    expect(result._renderLon).toBeCloseTo(28.0, 5);
  });
});
