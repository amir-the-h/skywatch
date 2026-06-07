import type { Aircraft } from '../types/aircraft';

const BASE = 'https://api.airplanes.live/v2/point';
const KM_TO_NM = 0.539957;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(raw: any): Aircraft | null {
  if (raw.lat == null || raw.lon == null) return null;
  return {
    hex: raw.hex ?? '',
    flight: (raw.flight ?? '').trim(),
    r: raw.r ?? '',
    t: raw.t ?? '',
    desc: raw.desc ?? undefined,
    lat: raw.lat,
    lon: raw.lon,
    alt_baro: typeof raw.alt_baro === 'number' ? raw.alt_baro : 0,
    gs: raw.gs ?? 0,
    track: raw.track ?? 0,
    baro_rate: raw.baro_rate ?? 0,
    mach: raw.mach,
    squawk: raw.squawk,
    emergency: raw.emergency,
    nav_altitude_mcp: raw.nav_altitude_mcp,
    nav_heading: raw.nav_heading,
    nav_modes: raw.nav_modes,
    ownOp: raw.ownOp,
    year: raw.year,
    orig_iata: raw.orig_iata ?? undefined,
    dest_iata: raw.dest_iata ?? undefined,
    orig_name: raw.orig_name ?? undefined,
    dest_name: raw.dest_name ?? undefined,
    seen: raw.seen ?? 0,
    _renderLat: raw.lat,
    _renderLon: raw.lon,
    _lastSeen: 0,
  };
}

export async function fetchAircraft(
  lat: number,
  lon: number,
  radiusKm: number
): Promise<Aircraft[]> {
  const radiusNm = Math.round(radiusKm * KM_TO_NM);
  const url = `${BASE}/${lat}/${lon}/${radiusNm}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`airplanes.live ${res.status}`);
  const data = await res.json();
  return (data.ac ?? []).map(normalize).filter(Boolean) as Aircraft[];
}
