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
