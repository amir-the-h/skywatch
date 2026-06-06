import type { Aircraft } from '../types/aircraft';

const MAX_INTERPOLATE_MS = 10_000;
const KTS_TO_KM_PER_MS = 1.852 / 3_600_000;
const R_KM = 6371;

export function interpolatePosition(ac: Aircraft, nowMs: number): Aircraft {
  const elapsedMs = Math.min(Math.max(nowMs - ac._lastSeen, 0), MAX_INTERPOLATE_MS);
  if (elapsedMs === 0 || ac.gs === 0) return ac;

  const distKm = ac.gs * KTS_TO_KM_PER_MS * elapsedMs;
  const bearingRad = (ac.track * Math.PI) / 180;

  const latRad = (ac._renderLat * Math.PI) / 180;
  const lonRad = (ac._renderLon * Math.PI) / 180;
  const d = distKm / R_KM;

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(d) + Math.cos(latRad) * Math.sin(d) * Math.cos(bearingRad)
  );
  const newLonRad =
    lonRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(d) * Math.cos(latRad),
      Math.cos(d) - Math.sin(latRad) * Math.sin(newLatRad)
    );

  return {
    ...ac,
    _renderLat: (newLatRad * 180) / Math.PI,
    _renderLon: (newLonRad * 180) / Math.PI,
  };
}
