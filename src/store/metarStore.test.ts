import { describe, it, expect, beforeEach } from 'vitest';
import { useMetarStore } from './metarStore';
import type { MetarData } from '../../shared/types';

const makeMetar = (windSpeed = 12): MetarData => ({
  windDir: 270, windSpeed, windGust: null,
  raw: 'KLAX 081353Z 27012KT', observedAt: '2026-06-08T13:53:00Z',
});

describe('metarStore', () => {
  beforeEach(() => {
    useMetarStore.setState({ metar: new Map() });
  });

  it('starts with empty map', () => {
    expect(useMetarStore.getState().metar.size).toBe(0);
  });

  it('mergeMetar adds new entries', () => {
    useMetarStore.getState().mergeMetar({ KLAX: makeMetar() });
    expect(useMetarStore.getState().metar.get('KLAX')).toEqual(makeMetar());
  });

  it('mergeMetar overwrites existing entries', () => {
    useMetarStore.getState().mergeMetar({ KLAX: makeMetar(12) });
    useMetarStore.getState().mergeMetar({ KLAX: makeMetar(25) });
    expect(useMetarStore.getState().metar.get('KLAX')!.windSpeed).toBe(25);
  });

  it('mergeMetar preserves entries not in update', () => {
    useMetarStore.getState().mergeMetar({ KLAX: makeMetar() });
    useMetarStore.getState().mergeMetar({ KORD: makeMetar(8) });
    expect(useMetarStore.getState().metar.has('KLAX')).toBe(true);
    expect(useMetarStore.getState().metar.has('KORD')).toBe(true);
  });
});
