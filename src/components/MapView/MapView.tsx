// src/components/MapView/MapView.tsx
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useAircraftStore } from '../../store/aircraftStore';
import { useSettingsStore } from '../../hooks/useSettings';
import { AircraftMarker } from './AircraftMarker';
import { AircraftOverlay } from './AircraftOverlay';
import { FlightPreview } from '../FlightBubble/FlightPreview';
import { FlightBubble } from '../FlightBubble/FlightBubble';
import { interpolatePosition } from '../../lib/interpolate';
import { useFilterStore } from '../../store/filterStore';
import { matchesFilter } from '../../lib/aircraftFilter';
import { FilterDrawer } from '../FilterDrawer/FilterDrawer';
import { aircraftColor } from '../../lib/colorSystem';

const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>';
const SAT_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SAT_ATTR = '&copy; Esri';

function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
}

export function MapView() {
  const { lat, lng, tileSource, theme } = useSettingsStore();
  const aircraftMap = useAircraftStore((s) => s.aircraft);
  const pinnedHexes = useAircraftStore((s) => s.pinnedHexes);
  const hoveredHex = useAircraftStore((s) => s.hoveredHex);
  const filters = useFilterStore();

  const [renderTick, setRenderTick] = useState(0);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const id = setInterval(() => setRenderTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const aircraft = Array.from(aircraftMap.values()).map((ac) =>
    interpolatePosition(ac, now)
  );
  void renderTick;

  const visibleAircraft = aircraft.filter((ac) => matchesFilter(ac, filters));
  const hoveredAircraft = hoveredHex ? aircraftMap.get(hoveredHex) : null;

  return (
    <div
      className="map-container"
      onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
    >
      <MapContainer
        center={[lat, lng]}
        zoom={8}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <MapRecenter lat={lat} lng={lng} />
        <TileLayer
          url={tileSource === 'osm' ? OSM_TILES : SAT_TILES}
          attribution={tileSource === 'osm' ? OSM_ATTR : SAT_ATTR}
        />
        {visibleAircraft.map((ac) => (
          <React.Fragment key={ac.hex}>
            <AircraftOverlay aircraft={ac} />
            <AircraftMarker aircraft={ac} />
          </React.Fragment>
        ))}
      </MapContainer>

      {hoveredAircraft && hoverPos && !pinnedHexes.has(hoveredAircraft.hex) && (
        <FlightPreview aircraft={hoveredAircraft} x={hoverPos.x} y={hoverPos.y} />
      )}

      <div className="bubbles-container">
        {[...pinnedHexes].map((hex) => {
          const ac = aircraftMap.get(hex);
          if (!ac || !matchesFilter(ac, filters)) return null;
          const color = aircraftColor(ac.t, theme);
          return <FlightBubble key={hex} aircraft={ac} color={color} />;
        })}
      </div>

      <FilterDrawer />
    </div>
  );
}
