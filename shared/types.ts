// shared/types.ts
export type FlightPhase = 'TXI' | 'GND' | 'T/O' | 'APP' | 'CLB' | 'DSC' | 'CRZ';

export interface BackendAircraft {
  hex: string;
  flight: string;
  r: string;
  t: string;
  desc?: string;
  lat: number;
  lon: number;
  alt_baro: number;
  gs: number;
  track: number;
  baro_rate: number;
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
  seen: number;
  phase: FlightPhase;
  pathHistory: { lat: number; lon: number }[];
}

export interface RunwayEnd {
  ident: string
  lat: number
  lon: number
}

export interface Runway {
  le: RunwayEnd
  he: RunwayEnd
  widthFt: number
  lengthFt: number
}

export type AirportType = 'large_airport' | 'medium_airport' | 'small_airport'

export interface Airport {
  icao: string
  iata: string
  name: string
  lat: number
  lon: number
  type: AirportType
  runways: Runway[]
}

export interface MetarData {
  windDir: number | null    // degrees magnetic; null = variable direction
  windSpeed: number         // knots
  windGust: number | null   // knots; null = no gust reported
  raw: string               // full raw METAR string
  observedAt: string        // ISO 8601 timestamp
}

export interface AirportsPayload {
  airports: Airport[]
  metar: Record<string, MetarData>
}

export type MetarUpdatePayload = Record<string, MetarData>
