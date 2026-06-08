import { useMetarStore } from '../store/metarStore';
import type { MetarData } from '../../../shared/types';

export function useMetar(): Map<string, MetarData> {
  return useMetarStore((s) => s.metar);
}
