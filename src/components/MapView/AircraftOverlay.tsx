import { Polyline } from 'react-leaflet';
import type { Aircraft } from '../../types/aircraft';
import { aircraftColor } from '../../lib/colorSystem';
import { lightenHsl } from '../../lib/colorSystem';
import { bearingToLatLon } from '../../lib/geoUtils';
import { useSettingsStore } from '../../hooks/useSettings';

interface Props {
  aircraft: Aircraft;
}

const HEADING_KM = 5;

export function AircraftOverlay({ aircraft }: Props) {
  const trailLength = useSettingsStore((s) => s.trailLength);

  const color = aircraftColor(aircraft.t);
  const trailColor = lightenHsl(color, 0.2);
  const fullHistory = aircraft.pathHistory ?? [];
  const history = trailLength > 0 ? fullHistory.slice(-trailLength) : [];

  const hasTrack = aircraft.track != null && !Number.isNaN(aircraft.track);
  const headingEnd = hasTrack
    ? bearingToLatLon(aircraft._renderLat, aircraft._renderLon, aircraft.track, HEADING_KM)
    : null;

  return (
    <>
      {history.length >= 2 && (
        <Polyline
          positions={history.map((p) => [p.lat, p.lon] as [number, number])}
          color={trailColor}
          weight={1.5}
          opacity={0.9}
        />
      )}
      {headingEnd && (
        <Polyline
          positions={[
            [aircraft._renderLat, aircraft._renderLon],
            [headingEnd.lat, headingEnd.lon],
          ]}
          color={color}
          weight={1.5}
          opacity={0.8}
          dashArray="5 8"
        />
      )}
    </>
  );
}
