// src/types/aircraft.ts
import type { BackendAircraft } from '../../shared/types';
export type { FlightPhase } from '../../shared/types';

export type AircraftFamily =
  | 'narrowbody-short'
  | 'narrowbody-long'
  | 'widebody-medium'
  | 'widebody-large'
  | 'very-large'
  | 'regional-small'
  | 'regional-medium'
  | 'regional-large'
  | 'turboprop'
  | 'bizjet-small'
  | 'bizjet-large'
  | 'military'
  | 'generic';

export type LabelCondition = 'always' | 'airport' | 'emergency' | 'pinned';

export interface Aircraft extends BackendAircraft {
  _renderLat: number;
  _renderLon: number;
  _lastSeen: number;
}

export interface Settings {
  lat: number;
  lng: number;
  radiusKm: number;
  theme: 'dark' | 'light';
  tileSource: 'osm' | 'satellite';
  view: 'map' | 'radar';
  ringIntervals: number[];
  trailLength: number;
  labelConditions: LabelCondition[];
  showAirports: boolean;
  airportTypes: ('large_airport' | 'medium_airport' | 'small_airport')[];
}

export const DEFAULT_SETTINGS: Settings = {
  lat: 41.0082,
  lng: 28.9784,
  radiusKm: 150,
  theme: 'dark',
  tileSource: 'osm',
  view: 'map',
  ringIntervals: [25, 50, 100, 150],
  trailLength: 50,
  labelConditions: ['always'],
  showAirports: true,
  airportTypes: ['large_airport', 'medium_airport'],
};
