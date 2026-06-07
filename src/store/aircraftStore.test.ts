import { describe, it, expect, beforeEach } from 'vitest';
import { useAircraftStore } from './aircraftStore';
import type { Aircraft } from '../types/aircraft';

function makeAc(hex: string, lat: number, lon: number, pathHistory: { lat: number; lon: number }[] = []): Aircraft {
  return {
    hex, flight: hex, r: hex, t: 'B738',
    lat, lon, alt_baro: 10000, gs: 400, track: 90,
    baro_rate: 0, seen: 1,
    phase: 'CRZ',
    pathHistory,
    _renderLat: lat, _renderLon: lon, _lastSeen: Date.now(),
  };
}

beforeEach(() => {
  useAircraftStore.setState({
    aircraft: new Map(),
    pinnedHexes: new Set(),
    hoveredHex: null,
    lastUpdated: null,
  });
});

describe('pathHistory', () => {
  it('records a position on first merge', () => {
    useAircraftStore.getState().mergeAircraft([makeAc('ABC123', 41, 28, [{ lat: 41, lon: 28 }])]);
    const history = useAircraftStore.getState().aircraft.get('ABC123')?.pathHistory;
    expect(history).toHaveLength(1);
    expect(history![0]).toEqual({ lat: 41, lon: 28 });
  });

  it('appends positions on subsequent merges', () => {
    useAircraftStore.getState().mergeAircraft([makeAc('ABC123', 41, 28, [{ lat: 41, lon: 28 }])]);
    useAircraftStore.getState().mergeAircraft([makeAc('ABC123', 41.1, 28.1, [{ lat: 41, lon: 28 }, { lat: 41.1, lon: 28.1 }])]);
    const history = useAircraftStore.getState().aircraft.get('ABC123')?.pathHistory;
    expect(history).toHaveLength(2);
    expect(history![1]).toEqual({ lat: 41.1, lon: 28.1 });
  });

  it('caps history at 50 entries', () => {
    const longHistory = Array.from({ length: 50 }, (_, i) => ({ lat: 41 + i * 0.01, lon: 28 }));
    useAircraftStore.getState().mergeAircraft([makeAc('ABC123', 41 + 49 * 0.01, 28, longHistory)]);
    const history = useAircraftStore.getState().aircraft.get('ABC123')?.pathHistory;
    expect(history).toHaveLength(50);
    expect(history![49].lat).toBeCloseTo(41 + 49 * 0.01, 3);
  });

  it('removes history for stale aircraft', () => {
    useAircraftStore.getState().mergeAircraft([makeAc('ABC123', 41, 28, [{ lat: 41, lon: 28 }])]);
    useAircraftStore.getState().removeStale(new Set());
    expect(useAircraftStore.getState().aircraft.has('ABC123')).toBe(false);
  });
});
