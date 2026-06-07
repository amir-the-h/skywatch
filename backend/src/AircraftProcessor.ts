import type { FlightPhase } from '../../shared/types';

export function inferFlightPhase(alt: number, gs: number, baro_rate: number): FlightPhase {
  if (alt <= 500 && gs >= 5 && gs <= 50) return 'TXI';
  if (alt <= 500 && gs < 5) return 'GND';
  if (alt < 3000 && baro_rate > 1000) return 'T/O';
  if (alt < 5000 && baro_rate < -300) return 'APP';
  if (baro_rate > 200) return 'CLB';
  if (baro_rate < -200) return 'DSC';
  return 'CRZ';
}
