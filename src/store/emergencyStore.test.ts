import { describe, it, expect, beforeEach } from 'vitest';
import { useEmergencyStore } from './emergencyStore';
import type { EmergencyAircraft } from '../../shared/types';

function makeEmAc(hex: string): EmergencyAircraft {
  return { hex, flight: hex, r: hex, squawk: '7700', lat: 0, lon: 0, alt_baro: 0, gs: 0, track: 0 };
}

beforeEach(() => {
  useEmergencyStore.setState({ aircraft: [], seenHexes: new Set(), pendingNotifications: [] });
});

describe('emergencyStore', () => {
  it('starts with an empty list', () => {
    expect(useEmergencyStore.getState().aircraft).toHaveLength(0);
  });

  it('setEmergency replaces the aircraft list', () => {
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

  it('first call produces pendingNotifications for all aircraft', () => {
    useEmergencyStore.getState().setEmergency([makeEmAc('A'), makeEmAc('B')]);
    expect(useEmergencyStore.getState().pendingNotifications.map((a) => a.hex)).toEqual(['A', 'B']);
  });

  it('second call with same aircraft produces no pendingNotifications', () => {
    useEmergencyStore.getState().setEmergency([makeEmAc('A')]);
    useEmergencyStore.getState().setEmergency([makeEmAc('A')]);
    expect(useEmergencyStore.getState().pendingNotifications).toHaveLength(0);
  });

  it('new aircraft in subsequent call produces notification for new one only', () => {
    useEmergencyStore.getState().setEmergency([makeEmAc('A')]);
    useEmergencyStore.getState().setEmergency([makeEmAc('A'), makeEmAc('B')]);
    expect(useEmergencyStore.getState().pendingNotifications.map((a) => a.hex)).toEqual(['B']);
  });

  it('aircraft that leaves and returns re-fires notification', () => {
    useEmergencyStore.getState().setEmergency([makeEmAc('A')]);
    useEmergencyStore.getState().setEmergency([]);     // A leaves
    useEmergencyStore.getState().setEmergency([makeEmAc('A')]); // A returns
    expect(useEmergencyStore.getState().pendingNotifications.map((a) => a.hex)).toEqual(['A']);
  });

  it('clearNotifications empties pendingNotifications', () => {
    useEmergencyStore.getState().setEmergency([makeEmAc('A')]);
    useEmergencyStore.getState().clearNotifications();
    expect(useEmergencyStore.getState().pendingNotifications).toHaveLength(0);
  });
});
