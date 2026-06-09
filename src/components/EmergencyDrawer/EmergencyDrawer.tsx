import { useEmergencyStore } from '../../store/emergencyStore';
import { useAircraftStore } from '../../store/aircraftStore';
import { useSettingsStore } from '../../hooks/useSettings';
import type { EmergencyAircraft } from '../../../../shared/types';

interface Props {
  onClose: () => void;
}

const SQUAWK_COLORS: Record<string, string> = {
  '7700': '#ef4444',
  '7500': '#f97316',
  '7600': '#eab308',
};

const EMERGENCY_LABELS: Record<string, string> = {
  '7700': 'MAYDAY',
  '7500': 'HIJACK',
  '7600': 'NORDO',
  general: 'MAYDAY',
  unlawful: 'HIJACK',
  nordo: 'NORDO',
  lifeguard: 'LIFEGUARD',
  minfuel: 'MIN FUEL',
  downed: 'DOWNED',
};

function getLabel(ac: EmergencyAircraft): string {
  return (
    EMERGENCY_LABELS[ac.squawk ?? ''] ??
    EMERGENCY_LABELS[ac.emergency ?? ''] ??
    'EMERGENCY'
  );
}

function getColor(ac: EmergencyAircraft): string {
  return SQUAWK_COLORS[ac.squawk ?? ''] ?? '#ef4444';
}

export function EmergencyDrawer({ onClose }: Props) {
  const aircraft = useEmergencyStore((s) => s.aircraft);
  const pin = useAircraftStore((s) => s.pin);
  const setFollowHex = useAircraftStore((s) => s.setFollowHex);
  const settings = useSettingsStore();

  function handleSelect(ac: EmergencyAircraft) {
    onClose();
    settings.update({ view: 'map' });
    pin(ac.hex);
    setFollowHex(ac.hex);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-header">
          <h2>Emergency Aircraft</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          {aircraft.length === 0 ? (
            <div className="emergency-empty">No active emergencies</div>
          ) : (
            aircraft.map((ac) => (
              <button
                key={ac.hex}
                className="emergency-row"
                onClick={() => handleSelect(ac)}
              >
                <span
                  className="emergency-badge"
                  style={{ background: getColor(ac) }}
                >
                  {getLabel(ac)}
                </span>
                <span className="emergency-callsign">{ac.flight || ac.hex}</span>
                {ac.r && <span className="emergency-reg">{ac.r}</span>}
                <span className="emergency-stats">
                  {ac.alt_baro.toLocaleString()} ft · {Math.round(ac.gs)} kt
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
