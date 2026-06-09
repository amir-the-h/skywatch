// src/components/MapView/MapView.tsx
import React, { useEffect, useRef, useState } from 'react';
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
import { aircraftColor } from '../../lib/colorSystem';
import { useEmergencyStore } from '../../store/emergencyStore';
import type { EmergencyAircraft } from '../../../../shared/types';
import type { Aircraft } from '../../types/aircraft';

function emergencyToAircraft(em: EmergencyAircraft): Aircraft {
  return {
    hex: em.hex,
    flight: em.flight,
    r: em.r,
    t: '',
    lat: em.lat,
    lon: em.lon,
    alt_baro: em.alt_baro,
    gs: em.gs,
    track: em.track,
    baro_rate: 0,
    squawk: em.squawk,
    emergency: em.emergency,
    seen: 0,
    phase: 'cruise',
    pathHistory: [],
    _renderLat: em.lat,
    _renderLon: em.lon,
    _lastSeen: Date.now(),
  };
}

const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>';
const SAT_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SAT_ATTR = '&copy; Esri';

function MapFollower() {
  const map = useMap();
  const followHex = useAircraftStore((s) => s.followHex);
  const setFollowHex = useAircraftStore((s) => s.setFollowHex);
  const aircraftMap = useAircraftStore((s) => s.aircraft);
  const emergencyAircraft = useEmergencyStore((s) => s.aircraft);

  // Refs so the interval callback always reads current values without re-creating the interval
  const followHexRef = useRef<string | null>(followHex);
  const aircraftMapRef = useRef(aircraftMap);
  const emergencyRef = useRef<EmergencyAircraft[]>(emergencyAircraft);
  followHexRef.current = followHex;
  aircraftMapRef.current = aircraftMap;
  emergencyRef.current = emergencyAircraft;

  useEffect(() => {
    const id = setInterval(() => {
      const hex = followHexRef.current;
      if (!hex) return;

      const ac = aircraftMapRef.current.get(hex);
      let lat: number | undefined;
      let lon: number | undefined;

      if (ac) {
        lat = ac._renderLat;
        lon = ac._renderLon;
      } else {
        const emAc = emergencyRef.current.find((a) => a.hex === hex);
        lat = emAc?.lat;
        lon = emAc?.lon;
      }

      if (lat !== undefined && lon !== undefined) {
        map.panTo([lat, lon], { animate: true, duration: 0.5 });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [map]);

  useEffect(() => {
    const onDragStart = () => setFollowHex(null);
    map.on('dragstart', onDragStart);
    return () => { map.off('dragstart', onDragStart); };
  }, [map, setFollowHex]);

  return null;
}

function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const followHex = useAircraftStore((s) => s.followHex);
  useEffect(() => {
    if (followHex) return;
    map.setView([lat, lng]);
  }, [lat, lng, map, followHex]);
  return null;
}

export function MapView() {
  const { lat, lng, tileSource } = useSettingsStore();
  const aircraftMap = useAircraftStore((s) => s.aircraft);
  const pinnedHexes = useAircraftStore((s) => s.pinnedHexes);
  const hoveredHex = useAircraftStore((s) => s.hoveredHex);
  const followHex = useAircraftStore((s) => s.followHex);
  const emergencyAircraft = useEmergencyStore((s) => s.aircraft);
  const filters = useFilterStore();

  const [renderTick, setRenderTick] = useState(0);
  const rafRef = useRef<number>(0);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const loop = () => {
      setRenderTick((t) => t + 1);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const now = Date.now();
  const aircraft = Array.from(aircraftMap.values()).map((ac) =>
    interpolatePosition(ac, now)
  );
  void renderTick;

  // Emergency aircraft pinned/followed but outside local radius — inject as synthetic markers
  const trackedHexes = new Set([...pinnedHexes, ...(followHex ? [followHex] : [])]);
  const emergencyOnly = emergencyAircraft
    .filter((em) => trackedHexes.has(em.hex) && !aircraftMap.has(em.hex))
    .map(emergencyToAircraft);

  const visibleAircraft = [...aircraft.filter((ac) => matchesFilter(ac, filters)), ...emergencyOnly];
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
        <MapFollower />
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
          const ac: Aircraft | undefined =
            aircraftMap.get(hex) ??
            emergencyOnly.find((e) => e.hex === hex);
          if (!ac) return null;
          if (aircraftMap.has(hex) && !matchesFilter(ac, filters)) return null;
          const color = aircraftColor(ac.t);
          return <FlightBubble key={hex} aircraft={ac} color={color} />;
        })}
      </div>

    </div>
  );
}
