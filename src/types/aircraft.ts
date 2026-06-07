// src/types/aircraft.ts

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

export interface Aircraft {
  hex: string;
  flight: string;           // callsign
  r: string;                // registration
  t: string;                // ICAO type code e.g. "B738"
  desc?: string;            // full aircraft description e.g. "BOEING 787-9 Dreamliner"
  lat: number;
  lon: number;
  alt_baro: number;         // feet
  gs: number;               // ground speed kts
  track: number;            // true track degrees (0 = north)
  baro_rate: number;        // ft/min
  mach?: number;
  squawk?: string;
  emergency?: string;
  nav_altitude_mcp?: number;
  nav_heading?: number;
  nav_modes?: string[];
  ownOp?: string;
  year?: string;
  orig_iata?: string;
  dest_iata?: string;
  orig_name?: string;
  dest_name?: string;
  seen: number;             // seconds since last message
  // client-side interpolation state
  _renderLat: number;
  _renderLon: number;
  _lastSeen: number;        // Date.now() timestamp when record was merged
}

export interface Settings {
  lat: number;
  lng: number;
  radiusKm: number;
  refreshInterval: number;  // seconds
  theme: 'dark' | 'light';
  tileSource: 'osm' | 'satellite';
  view: 'map' | 'radar';
  ringIntervals: number[];  // km, for radar view
}

export const DEFAULT_SETTINGS: Settings = {
  lat: 41.0082,
  lng: 28.9784,
  radiusKm: 150,
  refreshInterval: 5,
  theme: 'dark',
  tileSource: 'osm',
  view: 'map',
  ringIntervals: [25, 50, 100, 150],
};
