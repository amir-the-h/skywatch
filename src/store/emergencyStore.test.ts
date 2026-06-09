import { describe, it, expect, beforeEach } from 'vitest';
import { useEmergencyStore } from './emergencyStore';
import type { EmergencyAircraft } from '../../shared/types';

function makeEmAc(hex: string): EmergencyAircraft {
  return { hex, flight: hex, r: hex, squawk: '7700', lat: 0, lon: 0, alt_baro: 0, gs: 0, track: 0 };
}

beforeEach(() => {
  useEmergencyStore.setState({ aircraft: [] });
});

describe('emergencyStore', () => {
  it('starts with an empty list', () => {
    expect(useEmergencyStore.getState().aircraft).toHaveLength(0);
  });

  it('setEmergency replaces the list', () => {
    const list = [makeEmAc('ABC'), makeEmAc('DEF')];
    useEmergencyStore.getState().setEmergency(list);
    expect(useEmergencyStore.getState().aircraft).toHaveLength(2);
    expect(useEmergencyStore.getState().aircraft[0].hex).toBe('ABC');
  });

  it('setEmergency with empty list clears previous state', () => {
    useEmergencyStore.getState().setEmergency([makeEmAc('XYZ')]);
    useEmergencyStore.getState().setEmergency([]);
    expect(useEmergencyStore.getState().aircraft).toHaveLength(0);
  });
});
