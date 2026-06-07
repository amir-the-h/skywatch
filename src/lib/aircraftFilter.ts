import type { Aircraft } from '../types/aircraft';
import type { FlightPhase } from './flightPhase';
import { inferFlightPhase } from './flightPhase';

export interface FilterCriteria {
  callsign: string;
  altMin: number;
  altMax: number;
  phases: FlightPhase[];
  manufacturer: string;
  model: string;
}

export function matchesFilter(ac: Aircraft, filters: FilterCriteria): boolean {
  if (filters.callsign !== '' && !ac.flight?.toLowerCase().includes(filters.callsign.toLowerCase())) return false;
  if (ac.alt_baro < filters.altMin || ac.alt_baro > filters.altMax) return false;
  if (filters.phases.length > 0 && !filters.phases.includes(inferFlightPhase(ac))) return false;
  if (filters.manufacturer !== '' && !ac.desc?.toLowerCase().includes(filters.manufacturer.toLowerCase())) return false;
  if (filters.model !== '' && !ac.t?.toLowerCase().includes(filters.model.toLowerCase())) return false;
  return true;
}
