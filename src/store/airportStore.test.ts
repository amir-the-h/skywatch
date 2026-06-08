import { describe, it, expect, beforeEach } from 'vitest';
import { useAirportStore } from './airportStore';
import type { Airport } from '../../shared/types';

const makeAirport = (icao: string): Airport => ({
  icao, iata: icao.slice(1), name: `${icao} Airport`,
  lat: 34, lon: -118, type: 'large_airport', runways: [],
});

describe('airportStore', () => {
  beforeEach(() => {
    useAirportStore.setState({ airports: [] });
  });

  it('starts empty', () => {
    expect(useAirportStore.getState().airports).toHaveLength(0);
  });

  it('setAirports replaces the list', () => {
    const airports = [makeAirport('KLAX'), makeAirport('KORD')];
    useAirportStore.getState().setAirports(airports);
    expect(useAirportStore.getState().airports).toEqual(airports);
  });

  it('setAirports with empty array clears the list', () => {
    useAirportStore.getState().setAirports([makeAirport('KLAX')]);
    useAirportStore.getState().setAirports([]);
    expect(useAirportStore.getState().airports).toHaveLength(0);
  });
});
