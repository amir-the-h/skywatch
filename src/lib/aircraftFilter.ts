import type { Aircraft } from '../types/aircraft';
import type { FlightPhase } from './flightPhase';
import { inferFlightPhase } from './flightPhase';

export interface FilterCriteria {
  callsigns: string[];
  altMin: number;
  altMax: number;
  phases: FlightPhase[];
  manufacturers: string[];
  models: string[];
}

export function matchesFilter(ac: Aircraft, filters: FilterCriteria): boolean {
  if (filters.callsigns.length > 0 && !filters.callsigns.includes(ac.flight ?? '')) return false;
  if (ac.alt_baro < filters.altMin || ac.alt_baro > filters.altMax) return false;
  if (filters.phases.length > 0 && !filters.phases.includes(inferFlightPhase(ac))) return false;
  if (filters.manufacturers.length > 0 && !filters.manufacturers.includes(ac.desc ?? '')) return false;
  if (filters.models.length > 0 && !filters.models.includes(ac.t ?? '')) return false;
  return true;
}
