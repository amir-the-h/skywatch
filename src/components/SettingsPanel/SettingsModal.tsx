import { useState } from 'react';
import { useSettingsStore } from '../../hooks/useSettings';
import type { LabelCondition } from '../../types/aircraft';

interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
  const settings = useSettingsStore();
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [ringText, setRingText] = useState(settings.ringIntervals.join(', '));

  function toggleCondition(condition: LabelCondition) {
    if (condition === 'always') {
      const next = settings.labelConditions.includes('always') ? [] : ['always' as LabelCondition];
      settings.update({ labelConditions: next });
      return;
    }
    const without = settings.labelConditions.filter((c) => c !== 'always' && c !== condition);
    const next = settings.labelConditions.includes(condition)
      ? without
      : [...without, condition];
    settings.update({ labelConditions: next });
  }

  function handleGeolocate() {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      return;
    }
    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        settings.update({
          lat: parseFloat(pos.coords.latitude.toFixed(4)),
          lng: parseFloat(pos.coords.longitude.toFixed(4)),
        });
        setGeoStatus('idle');
      },
      () => {
        setGeoStatus('error');
      }
    );
  }

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
              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) settings.update({ lat: v }); }}
            />
          </label>

          <button
            className={`geo-btn${geoStatus === 'error' ? ' geo-btn--error' : ''}`}
            onClick={handleGeolocate}
            disabled={geoStatus === 'loading'}
          >
            {geoStatus === 'idle' && <><span aria-hidden="true">📍</span> Use my location</>}
            {geoStatus === 'loading' && <><span aria-hidden="true">⏳</span> Detecting…</>}
            {geoStatus === 'error' && <><span aria-hidden="true">⚠</span> Location unavailable — tap to retry</>}
          </button>

          <label>
            Longitude
            <input
              type="number"
              step="0.0001"
              value={settings.lng}
              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) settings.update({ lng: v }); }}
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

          <div className="modal-section-title">Display</div>

          <label>
            Trail length
            <input
              type="range"
              min={0}
              max={50}
              value={settings.trailLength}
              onChange={(e) => settings.update({ trailLength: parseInt(e.target.value) })}
            />
            <span>
              {settings.trailLength === 0
                ? 'Hidden'
                : `${settings.trailLength} pts · ≈${Math.round(settings.trailLength * settings.refreshInterval / 60)} min`}
            </span>
          </label>

          <div className="modal-section-title">Labels</div>

          {(['always', 'airport', 'emergency', 'pinned'] as LabelCondition[]).map((cond) => {
            const checked = settings.labelConditions.includes(cond);
            const disabled = cond !== 'always' && settings.labelConditions.includes('always');
            const labels: Record<LabelCondition, string> = {
              always: 'Always (show all)',
              airport: 'Airport ops (taxi / T/O / landing)',
              emergency: 'Emergency / unusual squawk',
              pinned: 'Pinned aircraft',
            };
            return (
              <label key={cond} className={disabled ? 'label-disabled' : ''}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleCondition(cond)}
                />
                {labels[cond]}
              </label>
            );
          })}

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
              value={ringText}
              onChange={(e) => setRingText(e.target.value)}
              onBlur={(e) => {
                const parsed = e.target.value
                  .split(',')
                  .map((v) => parseInt(v.trim()))
                  .filter((v) => !isNaN(v) && v > 0);
                if (parsed.length > 0) {
                  settings.update({ ringIntervals: parsed });
                  setRingText(parsed.join(', '));
                } else {
                  setRingText(settings.ringIntervals.join(', '));
                }
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
