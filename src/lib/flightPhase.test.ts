import { describe, it, expect } from 'vitest';
import { inferFlightPhase } from './flightPhase';
import type { Aircraft } from '../types/aircraft';

function ac(overrides: Partial<Aircraft>): Aircraft {
  return {
    hex: 'aaa', flight: 'TK1', r: 'TC-A', t: 'B738',
    lat: 41, lon: 28, alt_baro: 10000, gs: 400, track: 0,
    baro_rate: 0, seen: 1,
    _renderLat: 41, _renderLon: 28, _lastSeen: 0,
    ...overrides,
  };
}

describe('inferFlightPhase', () => {
  it('returns TXI when low alt and taxiing speed', () => {
    expect(inferFlightPhase(ac({ alt_baro: 200, gs: 25, baro_rate: 0 }))).toBe('TXI');
  });

  it('returns GND when very low alt and nearly stopped', () => {
    expect(inferFlightPhase(ac({ alt_baro: 100, gs: 2, baro_rate: 0 }))).toBe('GND');
  });

  it('returns T/O when below 3000ft and climbing fast', () => {
    expect(inferFlightPhase(ac({ alt_baro: 2000, gs: 160, baro_rate: 1500 }))).toBe('T/O');
  });

  it('returns APP when below 5000ft and descending', () => {
    expect(inferFlightPhase(ac({ alt_baro: 3000, gs: 180, baro_rate: -600 }))).toBe('APP');
  });

  it('returns CLB when climbing in cruise band', () => {
    expect(inferFlightPhase(ac({ alt_baro: 20000, baro_rate: 500 }))).toBe('CLB');
  });

  it('returns DSC when descending in cruise band', () => {
    expect(inferFlightPhase(ac({ alt_baro: 20000, baro_rate: -500 }))).toBe('DSC');
  });

  it('returns CRZ when level at cruise altitude', () => {
    expect(inferFlightPhase(ac({ alt_baro: 35000, baro_rate: 50 }))).toBe('CRZ');
  });

  it('TXI takes priority over GND when gs is in 5-50 range', () => {
    expect(inferFlightPhase(ac({ alt_baro: 0, gs: 10, baro_rate: 0 }))).toBe('TXI');
  });
});
