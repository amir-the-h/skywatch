import { useSettingsStore } from '../../hooks/useSettings';

interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
  const settings = useSettingsStore();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          <label>
            Latitude
            <input
              type="number"
              step="0.0001"
              value={settings.lat}
              onChange={(e) => settings.update({ lat: parseFloat(e.target.value) })}
            />
          </label>

          <label>
            Longitude
            <input
              type="number"
              step="0.0001"
              value={settings.lng}
              onChange={(e) => settings.update({ lng: parseFloat(e.target.value) })}
            />
          </label>

          <label>
            Radius (km)
            <input
              type="number"
              min={10}
              max={500}
              value={settings.radiusKm}
              onChange={(e) => settings.update({ radiusKm: parseInt(e.target.value) })}
            />
          </label>

          <label>
            Refresh interval (seconds)
            <input
              type="range"
              min={1}
              max={30}
              value={settings.refreshInterval}
              onChange={(e) => settings.update({ refreshInterval: parseInt(e.target.value) })}
            />
            <span>{settings.refreshInterval}s</span>
          </label>

          <label>
            Theme
            <select
              value={settings.theme}
              onChange={(e) =>
                settings.update({ theme: e.target.value as 'dark' | 'light' })
              }
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>

          <label>
            Radar rings (comma-separated km)
            <input
              type="text"
              value={settings.ringIntervals.join(', ')}
              onChange={(e) =>
                settings.update({
                  ringIntervals: e.target.value
                    .split(',')
                    .map((v) => parseInt(v.trim()))
                    .filter((v) => !isNaN(v) && v > 0),
                })
              }
            />
          </label>
        </div>
      </div>
    </div>
  );
}
