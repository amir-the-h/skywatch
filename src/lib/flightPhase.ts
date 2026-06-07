// src/lib/flightPhase.ts
export type { FlightPhase } from '../../shared/types';

export function getPhaseColor(phase: string): string {
  switch (phase) {
    case 'CLB':
    case 'T/O':
      return '#4ade80';
    case 'DSC':
    case 'APP':
      return '#f87171';
    default:
      return '#9ca3af';
  }
}
