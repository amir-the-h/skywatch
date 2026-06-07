import { describe, it, expect } from 'vitest';
import { matchesFilter } from './aircraftFilter';
import type { Aircraft } from '../types/aircraft';
import type { FilterCriteria } from './aircraftFilter';

function ac(overrides: Partial<Aircraft> = {}): Aircraft {
  return {
    hex: 'aaa', flight: 'UAL123', r: 'N123UA', t: 'B738',
    desc: 'BOEING 737-800',
    lat: 41, lon: 28, alt_baro: 35000, gs: 480, track: 0,
    baro_rate: 0, seen: 1,
    _renderLat: 41, _renderLon: 28, _lastSeen: 0,
    ...overrides,
  };
}

const defaults: FilterCriteria = {
  callsigns: [],
  altMin: 0,
  altMax: 60000,
  phases: [],
  manufacturers: [],
  models: [],
};

describe('matchesFilter', () => {
  it('passes all aircraft when all criteria are defaults', () => {
    expect(matchesFilter(ac(), defaults)).toBe(true);
  });

  describe('callsign filter', () => {
    it('matches exact callsign', () => {
      expect(matchesFilter(ac({ flight: 'UAL123' }), { ...defaults, callsigns: ['UAL123'] })).toBe(true);
    });

    it('rejects non-matching callsign', () => {
      expect(matchesFilter(ac({ flight: 'RYR456' }), { ...defaults, callsigns: ['UAL123'] })).toBe(false);
    });

    it('passes when callsigns filter is empty', () => {
      expect(matchesFilter(ac({ flight: 'RYR456' }), { ...defaults, callsigns: [] })).toBe(true);
    });

    it('handles aircraft with no flight field', () => {
      expect(matchesFilter(ac({ flight: '' }), { ...defaults, callsigns: ['UAL123'] })).toBe(false);
    });

    it('matches any of multiple selected callsigns', () => {
      expect(matchesFilter(ac({ flight: 'RYR456' }), { ...defaults, callsigns: ['UAL123', 'RYR456'] })).toBe(true);
    });
  });

  describe('altitude filter', () => {
    it('passes aircraft within range', () => {
      expect(matchesFilter(ac({ alt_baro: 20000 }), { ...defaults, altMin: 10000, altMax: 30000 })).toBe(true);
    });

    it('rejects aircraft below minimum', () => {
      expect(matchesFilter(ac({ alt_baro: 5000 }), { ...defaults, altMin: 10000, altMax: 30000 })).toBe(false);
    });

    it('rejects aircraft above maximum', () => {
      expect(matchesFilter(ac({ alt_baro: 40000 }), { ...defaults, altMin: 10000, altMax: 30000 })).toBe(false);
    });

    it('passes at exact boundary values', () => {
      expect(matchesFilter(ac({ alt_baro: 10000 }), { ...defaults, altMin: 10000, altMax: 30000 })).toBe(true);
      expect(matchesFilter(ac({ alt_baro: 30000 }), { ...defaults, altMin: 10000, altMax: 30000 })).toBe(true);
    });
  });

  describe('phase filter', () => {
    it('passes all aircraft when phases array is empty', () => {
      expect(matchesFilter(ac({ alt_baro: 35000, baro_rate: 0 }), { ...defaults, phases: [] })).toBe(true);
    });

    it('passes aircraft in matching phase', () => {
      // CRZ: level at cruise altitude
      expect(matchesFilter(ac({ alt_baro: 35000, baro_rate: 0 }), { ...defaults, phases: ['CRZ'] })).toBe(true);
    });

    it('rejects aircraft not in selected phases', () => {
      expect(matchesFilter(ac({ alt_baro: 35000, baro_rate: 0 }), { ...defaults, phases: ['CLB', 'DSC'] })).toBe(false);
    });

    it('passes when aircraft matches any selected phase', () => {
      // CLB: baro_rate > 200
      expect(matchesFilter(ac({ alt_baro: 20000, baro_rate: 500 }), { ...defaults, phases: ['CLB', 'CRZ'] })).toBe(true);
    });
  });

  describe('manufacturer filter', () => {
    it('matches exact manufacturer in ac.desc', () => {
      expect(matchesFilter(ac({ desc: 'BOEING 737-800' }), { ...defaults, manufacturers: ['BOEING 737-800'] })).toBe(true);
    });

    it('rejects non-matching manufacturer', () => {
      expect(matchesFilter(ac({ desc: 'BOEING 737-800' }), { ...defaults, manufacturers: ['AIRBUS A320'] })).toBe(false);
    });

    it('passes when manufacturers is empty', () => {
      expect(matchesFilter(ac(), { ...defaults, manufacturers: [] })).toBe(true);
    });

    it('passes when aircraft has no desc and filter is empty', () => {
      expect(matchesFilter(ac({ desc: undefined }), { ...defaults, manufacturers: [] })).toBe(true);
    });

    it('rejects when aircraft has no desc and filter is set', () => {
      expect(matchesFilter(ac({ desc: undefined }), { ...defaults, manufacturers: ['BOEING 737-800'] })).toBe(false);
    });

    it('matches any of multiple selected manufacturers', () => {
      expect(matchesFilter(ac({ desc: 'AIRBUS A320' }), { ...defaults, manufacturers: ['BOEING 737-800', 'AIRBUS A320'] })).toBe(true);
    });
  });

  describe('model filter', () => {
    it('matches exact model in ac.t', () => {
      expect(matchesFilter(ac({ t: 'B738' }), { ...defaults, models: ['B738'] })).toBe(true);
    });

    it('rejects non-matching model', () => {
      expect(matchesFilter(ac({ t: 'B738' }), { ...defaults, models: ['A320'] })).toBe(false);
    });

    it('matches any of multiple selected models', () => {
      expect(matchesFilter(ac({ t: 'A320' }), { ...defaults, models: ['B738', 'A320'] })).toBe(true);
    });
  });

  describe('AND logic across fields', () => {
    it('requires all active criteria to match', () => {
      // callsign matches but phase doesn't
      expect(matchesFilter(
        ac({ flight: 'UAL123', alt_baro: 35000, baro_rate: 0 }),
        { ...defaults, callsigns: ['UAL123'], phases: ['CLB'] }
      )).toBe(false);
    });

    it('passes when all criteria match', () => {
      expect(matchesFilter(
        ac({ flight: 'UAL123', alt_baro: 35000, baro_rate: 0 }),
        { ...defaults, callsigns: ['UAL123'], phases: ['CRZ'] }
      )).toBe(true);
    });
  });
});
