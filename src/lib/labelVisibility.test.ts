import { describe, it, expect } from 'vitest';
import { shouldShowLabel } from './labelVisibility';
import type { Aircraft } from '../types/aircraft';
import type { LabelCondition } from '../types/aircraft';

function ac(overrides: Partial<Aircraft> = {}): Aircraft {
  return {
    hex: 'aaa', flight: 'TK1', r: 'TC-A', t: 'B738',
    lat: 41, lon: 28, alt_baro: 35000, gs: 480, track: 0,
    baro_rate: 0, seen: 1, phase: 'CRZ', pathHistory: [],
    _renderLat: 41, _renderLon: 28, _lastSeen: 0,
    ...overrides,
  };
}

const emptyPinned = new Set<string>();
const withPinned = (hex: string) => new Set([hex]);

describe('shouldShowLabel', () => {
  describe("'always' condition", () => {
    it('returns true for any aircraft when always is set', () => {
      expect(shouldShowLabel(ac(), emptyPinned, ['always'])).toBe(true);
    });

    it('returns true even when other conditions would not match', () => {
      expect(shouldShowLabel(ac({ alt_baro: 35000, baro_rate: 0 }), emptyPinned, ['always'])).toBe(true);
    });
  });

  describe("'airport' condition", () => {
    it('returns true for taxiing aircraft', () => {
      expect(shouldShowLabel(ac({ alt_baro: 200, gs: 25, phase: 'TXI' }), emptyPinned, ['airport'])).toBe(true);
    });

    it('returns true for ground aircraft', () => {
      expect(shouldShowLabel(ac({ alt_baro: 100, gs: 2, phase: 'GND' }), emptyPinned, ['airport'])).toBe(true);
    });

    it('returns true for takeoff aircraft', () => {
      expect(shouldShowLabel(ac({ alt_baro: 2000, gs: 160, baro_rate: 1500, phase: 'T/O' }), emptyPinned, ['airport'])).toBe(true);
    });

    it('returns true for approach aircraft', () => {
      expect(shouldShowLabel(ac({ alt_baro: 3000, gs: 180, baro_rate: -600, phase: 'APP' }), emptyPinned, ['airport'])).toBe(true);
    });

    it('returns false for cruising aircraft', () => {
      expect(shouldShowLabel(ac({ alt_baro: 35000, baro_rate: 0, phase: 'CRZ' }), emptyPinned, ['airport'])).toBe(false);
    });
  });

  describe("'emergency' condition", () => {
    it('returns true for squawk 7700', () => {
      expect(shouldShowLabel(ac({ squawk: '7700' }), emptyPinned, ['emergency'])).toBe(true);
    });

    it('returns true for squawk 7600', () => {
      expect(shouldShowLabel(ac({ squawk: '7600' }), emptyPinned, ['emergency'])).toBe(true);
    });

    it('returns true for squawk 7500', () => {
      expect(shouldShowLabel(ac({ squawk: '7500' }), emptyPinned, ['emergency'])).toBe(true);
    });

    it('returns true when emergency field is set', () => {
      expect(shouldShowLabel(ac({ emergency: 'general' }), emptyPinned, ['emergency'])).toBe(true);
    });

    it('returns false when emergency is "none"', () => {
      expect(shouldShowLabel(ac({ emergency: 'none' }), emptyPinned, ['emergency'])).toBe(false);
    });

    it('returns false for normal aircraft', () => {
      expect(shouldShowLabel(ac(), emptyPinned, ['emergency'])).toBe(false);
    });
  });

  describe("'pinned' condition", () => {
    it('returns true when aircraft is pinned', () => {
      expect(shouldShowLabel(ac({ hex: 'aaa' }), withPinned('aaa'), ['pinned'])).toBe(true);
    });

    it('returns false when aircraft is not pinned', () => {
      expect(shouldShowLabel(ac({ hex: 'aaa' }), withPinned('bbb'), ['pinned'])).toBe(false);
    });
  });

  describe('combinable conditions', () => {
    it('returns true when any condition matches', () => {
      expect(shouldShowLabel(ac({ squawk: '7700' }), emptyPinned, ['airport', 'emergency'])).toBe(true);
    });

    it('returns false when no condition matches', () => {
      expect(shouldShowLabel(ac({ alt_baro: 35000, baro_rate: 0, phase: 'CRZ' }), emptyPinned, ['airport', 'pinned'])).toBe(false);
    });
  });

  describe('empty conditions', () => {
    it('returns false when conditions array is empty', () => {
      expect(shouldShowLabel(ac(), emptyPinned, [])).toBe(false);
    });
  });
});
