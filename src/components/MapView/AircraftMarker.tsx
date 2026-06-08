// src/components/MapView/AircraftMarker.tsx
import { useMemo } from 'react';
import { Marker } from 'react-leaflet';
import { divIcon } from 'leaflet';
import type { Aircraft } from '../../types/aircraft';
import { aircraftColor } from '../../lib/colorSystem';
import { getAircraftFamily, SILHOUETTE_PATHS, SILHOUETTE_VIEWBOX } from '../../lib/silhouettes';
import { useAircraftStore } from '../../store/aircraftStore';
import { useSettingsStore } from '../../hooks/useSettings';

interface Props {
  aircraft: Aircraft;
}

const ICON_SIZE = 40;

export function AircraftMarker({ aircraft }: Props) {
  const pin = useAircraftStore((s) => s.pin);
  const setHovered = useAircraftStore((s) => s.setHovered);
  const isPinned = useAircraftStore((s) => s.pinnedHexes.has(aircraft.hex));
  const isEmergency = (!!aircraft.emergency && aircraft.emergency !== 'none') || ['7700','7600','7500'].includes(aircraft.squawk ?? '');

  const color = aircraftColor(aircraft.t);
  const family = getAircraftFamily(aircraft.t);
  const path = SILHOUETTE_PATHS[family];
  const glowStdDev = isEmergency ? 5 : isPinned ? 3 : 1.5;

  const icon = useMemo(
    () =>
      divIcon({
        className: '',
        iconSize: [ICON_SIZE, ICON_SIZE],
        iconAnchor: [ICON_SIZE / 2, ICON_SIZE / 2],
        html: `<svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="${SILHOUETTE_VIEWBOX}"
          width="${ICON_SIZE}"
          height="${ICON_SIZE}"
          style="transform: rotate(${aircraft.track}deg); overflow: visible;"
        >
          <defs>
            <filter id="glow-${aircraft.hex}" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="${glowStdDev}" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <path
            d="${path}"
            fill="${color}"
            fill-opacity="0.6"
            stroke="${color}"
            stroke-width="3"
            filter="url(#glow-${aircraft.hex})"
          />
        </svg>`,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aircraft.track, aircraft.t, color, isPinned, isEmergency, glowStdDev]
  );

  return (
    <Marker
      position={[aircraft._renderLat, aircraft._renderLon]}
      icon={icon}
      eventHandlers={{
        click: () => pin(aircraft.hex),
        mouseover: () => setHovered(aircraft.hex),
        mouseout: () => setHovered(null),
      }}
    />
  );
}
