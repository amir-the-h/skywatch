import { describe, it, expect } from 'vitest';
import { normalizeRaw } from './normalize';

describe('normalizeRaw', () => {
  it('returns null when lat is missing', () => {
    expect(normalizeRaw({ hex: 'abc', lon: 10 }, 'CRZ')).toBeNull();
  });

  it('returns null when lon is missing', () => {
    expect(normalizeRaw({ hex: 'abc', lat: 10 }, 'CRZ')).toBeNull();
  });

  it('normalizes a valid raw record', () => {
    const raw = {
      hex: 'ABC123', flight: ' UAL1  ', r: 'N123AB', t: 'B738',
      lat: 40.5, lon: -73.8, alt_baro: 35000, gs: 450, track: 90,
      baro_rate: 100, squawk: '7700',
    };
    const result = normalizeRaw(raw, 'CRZ');
    expect(result).toMatchObject({
      hex: 'ABC123',
      flight: 'UAL1',
      lat: 40.5,
      lon: -73.8,
      alt_baro: 35000,
      squawk: '7700',
      phase: 'CRZ',
    });
  });

  it('defaults missing numeric fields to 0', () => {
    const result = normalizeRaw({ hex: 'X', lat: 1, lon: 2 }, 'GND');
    expect(result?.alt_baro).toBe(0);
    expect(result?.gs).toBe(0);
    expect(result?.track).toBe(0);
    expect(result?.baro_rate).toBe(0);
  });
});
