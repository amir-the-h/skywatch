import type { Aircraft } from '../types/aircraft';

export type FlightPhase = 'TXI' | 'GND' | 'T/O' | 'APP' | 'CLB' | 'DSC' | 'CRZ';

export function inferFlightPhase(ac: Aircraft): FlightPhase {
  const alt = ac.alt_baro;
  const gs = ac.gs;
  const rate = ac.baro_rate;

  if (alt <= 500 && gs >= 5 && gs <= 50) return 'TXI';
  if (alt <= 500 && gs < 5) return 'GND';
  if (alt < 3000 && rate > 1000) return 'T/O';
  if (alt < 5000 && rate < -300) return 'APP';
  if (rate > 200) return 'CLB';
  if (rate < -200) return 'DSC';
  return 'CRZ';
}

export function getPhaseColor(phase: FlightPhase): string {
  switch (phase) {
    case 'CLB': case 'T/O': return '#4ade80';
    case 'DSC': case 'APP': return '#f87171';
    default: return '#9ca3af';
  }
}
