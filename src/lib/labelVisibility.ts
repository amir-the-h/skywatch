import type { Aircraft, LabelCondition } from '../types/aircraft';
import { inferFlightPhase } from './flightPhase';

const AIRPORT_PHASES = new Set(['TXI', 'GND', 'T/O', 'APP']);
const EMERGENCY_SQUAWKS = new Set(['7500', '7600', '7700']);

export function shouldShowLabel(
  ac: Aircraft,
  pinnedHexes: Set<string>,
  conditions: LabelCondition[]
): boolean {
  if (conditions.includes('always')) return true;
  if (conditions.includes('airport') && AIRPORT_PHASES.has(inferFlightPhase(ac))) return true;
  if (conditions.includes('emergency')) {
    const sq = ac.squawk ?? '';
    const em = ac.emergency ?? '';
    if (EMERGENCY_SQUAWKS.has(sq) || (em !== '' && em !== 'none')) return true;
  }
  if (conditions.includes('pinned') && pinnedHexes.has(ac.hex)) return true;
  return false;
}
