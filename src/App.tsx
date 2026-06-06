// src/App.tsx
import { useEffect, useState } from 'react';
import { useSettingsStore } from './hooks/useSettings';
import { useAircraftFeed } from './hooks/useAircraftFeed';
import { useAircraftStore } from './store/aircraftStore';
import { MapView } from './components/MapView/MapView';
import { RadarView } from './components/RadarView/RadarView';
import { SettingsModal } from './components/SettingsPanel/SettingsModal';

function StatusChip() {
  const lastUpdated = useAircraftStore((s) => s.lastUpdated);
  const aircraft = useAircraftStore((s) => s.aircraft);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const secondsAgo = lastUpdated ? Math.round((now - lastUpdated) / 1000) : null;
  const isStale = secondsAgo != null && secondsAgo > 15;

  return (
    <div className={`status-chip ${isStale ? 'stale' : ''}`}>
      {aircraft.size} aircraft
      {secondsAgo != null && ` · ${secondsAgo}s ago`}
    </div>
  );
}

export default function App() {
  const settings = useSettingsStore();
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    document.body.className = `theme-${settings.theme}`;
  }, [settings.theme]);

  useAircraftFeed();

  return (
    <>
      {settings.view === 'map' ? <MapView /> : <RadarView />}

      <div className="hud">
        <div className="hud-topleft">
          <div className="app-logo">✈ FlightTracker</div>

          <div className="chip-group">
            <button
              className={`chip ${settings.view === 'map' ? 'active' : ''}`}
              onClick={() => settings.update({ view: 'map' })}
            >
              MAP
            </button>
            <button
              className={`chip ${settings.view === 'radar' ? 'active' : ''}`}
              onClick={() => settings.update({ view: 'radar' })}
            >
              RADAR
            </button>
          </div>

          {settings.view === 'map' && (
            <div className="chip-group">
              <button
                className={`chip ${settings.tileSource === 'osm' ? 'active' : ''}`}
                onClick={() => settings.update({ tileSource: 'osm' })}
              >
                OSM
              </button>
              <button
                className={`chip ${settings.tileSource === 'satellite' ? 'active' : ''}`}
                onClick={() => settings.update({ tileSource: 'satellite' })}
              >
                SAT
              </button>
            </div>
          )}
        </div>

        <div className="hud-topright">
          <button
            className="icon-btn"
            onClick={() => settings.update({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
            title="Toggle theme"
          >
            {settings.theme === 'dark' ? '☀' : '☾'}
          </button>
          <button
            className="icon-btn"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙
          </button>
        </div>

        <div className="hud-bottomleft">
          <StatusChip />
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
