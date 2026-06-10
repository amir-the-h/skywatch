// src/App.tsx
import { useEffect, useState } from 'react';
import { useSettingsStore } from './hooks/useSettings';
import { useAircraftSocket } from './hooks/useAircraftSocket';
import { useVersionPoller } from './hooks/useVersionPoller';
import { useIdleCursor } from './hooks/useIdleCursor';
import { useAircraftStore } from './store/aircraftStore';
import { useEmergencyStore } from './store/emergencyStore';
import { useToastStore } from './store/toastStore';
import { ToastContainer } from './components/ToastContainer/ToastContainer';
import { playEmergencyAlert } from './lib/audio';
import { MapView } from './components/MapView/MapView';
import { RadarView } from './components/RadarView/RadarView';
import { SettingsModal } from './components/SettingsPanel/SettingsModal';
import { FilterDrawer } from './components/FilterDrawer/FilterDrawer';
import { EmergencyDrawer } from './components/EmergencyDrawer/EmergencyDrawer';

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

function EmergencyChip({ onClick }: { onClick: () => void }) {
  const count = useEmergencyStore((s) => s.aircraft.length);
  return (
    <button
      className={`chip ${count > 0 ? 'emergency-active' : 'emergency-quiet'}`}
      onClick={onClick}
      title="Emergency aircraft worldwide"
    >
      {count > 0 ? `EMER (${count})` : 'EMER'}
    </button>
  );
}

export default function App() {
  const settings = useSettingsStore();
  const [showSettings, setShowSettings] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);

  const pendingNotifications = useEmergencyStore((s) => s.pendingNotifications);
  const clearNotifications = useEmergencyStore((s) => s.clearNotifications);
  const addToast = useToastStore((s) => s.addToast);
  const muteEmergencyAlerts = useSettingsStore((s) => s.muteEmergencyAlerts);

  useEffect(() => {
    document.body.className = 'theme-dark';
  }, []);

  useEffect(() => {
    if (pendingNotifications.length === 0) return;
    pendingNotifications.forEach((ac) => addToast(ac));
    if (!muteEmergencyAlerts) playEmergencyAlert();
    clearNotifications();
  }, [pendingNotifications, addToast, clearNotifications, muteEmergencyAlerts]);

  useAircraftSocket();
  useVersionPoller();
  useIdleCursor();

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
          <EmergencyChip onClick={() => setShowEmergency(true)} />
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

      <FilterDrawer />
      <ToastContainer />

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showEmergency && <EmergencyDrawer onClose={() => setShowEmergency(false)} />}
    </>
  );
}
