// src/components/FlightBubble/FlightBubble.tsx
import { useState } from 'react';
import type { Aircraft } from '../../types/aircraft';
import { useAircraftStore } from '../../store/aircraftStore';

const EMERGENCY_LABELS: Record<string, string> = {
  '7700': 'General Emergency',
  'general': 'General Emergency',
  '7600': 'Radio Failure (NORDO)',
  'nordo': 'Radio Failure (NORDO)',
  '7500': 'Hijacking',
  'unlawful': 'Hijacking',
  'lifeguard': 'Medical Emergency',
  'minfuel': 'Minimum Fuel',
  'downed': 'Downed Aircraft',
};

function getEmergencyLabel(aircraft: Aircraft): string | null {
  const sq = aircraft.squawk ?? '';
  const em = aircraft.emergency ?? '';
  return EMERGENCY_LABELS[sq] ?? EMERGENCY_LABELS[em] ?? null;
}

interface Props {
  aircraft: Aircraft;
  color: string;
}

export function FlightBubble({ aircraft, color }: Props) {
  const unpin = useAircraftStore((s) => s.unpin);
  const [autopilotOpen, setAutopilotOpen] = useState(false);
  const emergencyLabel = getEmergencyLabel(aircraft);
  const hasRoute = !!(aircraft.orig_iata || aircraft.dest_iata);

  return (
    <div
      className={`flight-bubble ${emergencyLabel ? 'emergency' : ''}`}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      {emergencyLabel && (
        <div className="emergency-banner">{emergencyLabel}</div>
      )}

      <div className="bubble-header">
        <div>
          <strong style={{ color }}>{aircraft.flight || aircraft.hex}</strong>
          {aircraft.r && <span className="reg"> · {aircraft.r}</span>}
        </div>
        <button className="icon-btn" onClick={() => unpin(aircraft.hex)} aria-label="Close">✕</button>
      </div>

      <div className="bubble-type">
        {aircraft.desc ?? aircraft.t}{aircraft.year ? ` · ${aircraft.year}` : ''}{aircraft.ownOp ? ` · ${aircraft.ownOp}` : ''}
      </div>

      {hasRoute && (
        <div className="bubble-route" style={{ borderColor: `color-mix(in srgb, ${color} 20%, transparent)`, background: `color-mix(in srgb, ${color} 7%, transparent)` }}>
          <span className="route-codes">
            {aircraft.orig_iata ?? '?'}
            <span className="route-arrow"> → </span>
            {aircraft.dest_iata ?? '?'}
          </span>
          {(aircraft.orig_name || aircraft.dest_name) && (
            <div className="route-cities">
              {[aircraft.orig_name, aircraft.dest_name].filter(Boolean).join(' → ')}
            </div>
          )}
        </div>
      )}

      <div className="bubble-section">
        <div className="bubble-row">
          {aircraft.alt_baro.toLocaleString()} ft
          {aircraft.baro_rate !== 0 && (
            <span className={aircraft.baro_rate > 0 ? 'climb' : 'descend'}>
              {' '}{aircraft.baro_rate > 0 ? '▲' : '▼'} {Math.abs(aircraft.baro_rate)} fpm
            </span>
          )}
        </div>
        <div className="bubble-row">
          {Math.round(aircraft.gs)} kts · {Math.round(aircraft.track)}°
          {aircraft.mach != null && ` · M${aircraft.mach.toFixed(2)}`}
        </div>
        {aircraft.squawk && (
          <div className="bubble-row">Squawk {aircraft.squawk}</div>
        )}
        <div className="bubble-row muted">{aircraft.seen}s ago</div>
      </div>

      {(aircraft.nav_altitude_mcp != null || aircraft.nav_heading != null || aircraft.nav_modes?.length) && (
        <details
          className="bubble-autopilot"
          open={autopilotOpen}
          onToggle={(e) => setAutopilotOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary>▼ Autopilot</summary>
          {aircraft.nav_altitude_mcp != null && (
            <div className="bubble-row">Target alt: {aircraft.nav_altitude_mcp.toLocaleString()} ft</div>
          )}
          {aircraft.nav_heading != null && (
            <div className="bubble-row">Sel heading: {Math.round(aircraft.nav_heading)}°</div>
          )}
          {aircraft.nav_modes?.length && (
            <div className="bubble-row">Modes: {aircraft.nav_modes.join(', ')}</div>
          )}
        </details>
      )}
    </div>
  );
}
