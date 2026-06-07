// src/components/RadarView/RadarView.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAircraftStore } from '../../store/aircraftStore';
import { useSettingsStore } from '../../hooks/useSettings';
import { interpolatePosition } from '../../lib/interpolate';
import { aircraftColor } from '../../lib/colorSystem';
import { drawRadar } from './RadarCanvas';
import { FlightBubble } from '../FlightBubble/FlightBubble';
import { FlightPreview } from '../FlightBubble/FlightPreview';
import { latLonToCanvas } from '../../lib/geoUtils';
import { applyZoom } from './viewTransform';
import { useFilterStore } from '../../store/filterStore';
import { matchesFilter } from '../../lib/aircraftFilter';
import { useAirports } from '../../hooks/useAirports';
import { findClosestAirport } from '../../lib/geoUtils';
import { AirportPreview } from './AirportPreview';
import type { Airport } from '../../types/airport';

export function RadarView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const { lat, lng, radiusKm, ringIntervals, theme, trailLength, labelConditions } = useSettingsStore();
  const aircraftMap = useAircraftStore((s) => s.aircraft);
  const pinnedHexes = useAircraftStore((s) => s.pinnedHexes);
  const hoveredHex = useAircraftStore((s) => s.hoveredHex);
  const pin = useAircraftStore((s) => s.pin);
  const setHovered = useAircraftStore((s) => s.setHovered);

  const hoveredHexRef = useRef(hoveredHex);
  const pinnedHexesRef = useRef(pinnedHexes);
  useEffect(() => { hoveredHexRef.current = hoveredHex; }, [hoveredHex]);
  useEffect(() => { pinnedHexesRef.current = pinnedHexes; }, [pinnedHexes]);

  const zoomLevelRef = useRef(1);
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const pinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mirror settings into refs so the wheel callback reads fresh values
  const latRef = useRef(lat);
  const lngRef = useRef(lng);
  const radiusKmRef = useRef(radiusKm);
  const trailLengthRef = useRef(trailLength);
  const labelConditionsRef = useRef(labelConditions);
  useEffect(() => {
    latRef.current = lat;
    lngRef.current = lng;
    radiusKmRef.current = radiusKm;
  }, [lat, lng, radiusKm]);
  useEffect(() => { trailLengthRef.current = trailLength; }, [trailLength]);
  useEffect(() => { labelConditionsRef.current = labelConditions; }, [labelConditions]);

  const filters = useFilterStore();
  const filtersRef = useRef(filters);
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  const { airports } = useAirports();
  const airportsRef = useRef<Airport[]>([]);
  useEffect(() => { airportsRef.current = airports; }, [airports]);

  const [hoveredAirport, setHoveredAirport] = useState<Airport | null>(null);
  const [zoomScale, setZoomScale] = useState(1);

  // Reset zoom when radius changes
  useEffect(() => {
    zoomLevelRef.current = 1;
  }, [radiusKm]);

  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const hoveredAircraft = hoveredHex ? aircraftMap.get(hoveredHex) : null;

  // rAF draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      const now = Date.now();
      const allAircraft = Array.from(aircraftMap.values()).map((ac) =>
        interpolatePosition(ac, now)
      );
      const aircraft = allAircraft.filter((ac) => matchesFilter(ac, filtersRef.current));
      const effectiveRadius = radiusKmRef.current / zoomLevelRef.current;
      drawRadar({
        ctx,
        width: canvas.width,
        height: canvas.height,
        centerLat: latRef.current,
        centerLon: lngRef.current,
        radiusKm: effectiveRadius,
        ringIntervals,
        aircraft,
        hoveredHex: hoveredHexRef.current,
        pinnedHexes: pinnedHexesRef.current,
        theme,
        panOffset: panOffsetRef.current,
        trailLength: trailLengthRef.current,
        labelConditions: labelConditionsRef.current,
        airports: airportsRef.current,
        zoomLevel: zoomLevelRef.current,
      });
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [lat, lng, radiusKm, ringIntervals, theme, aircraftMap]);

  // Non-passive wheel listener for zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const PIXELS_PER_LINE = 16;
      const PIXELS_PER_PAGE = 400;
      const normalizedDeltaY =
        e.deltaMode === 2
          ? e.deltaY * PIXELS_PER_PAGE
          : e.deltaMode === 1
            ? e.deltaY * PIXELS_PER_LINE
            : e.deltaY;
      const oldZoom = zoomLevelRef.current;
      zoomLevelRef.current = applyZoom(oldZoom, normalizedDeltaY);
      setZoomScale(Math.sqrt(zoomLevelRef.current));
      const f = zoomLevelRef.current / oldZoom;
      if (f === 1) return;
      // Keep the point under the cursor fixed as zoom changes
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left - canvas.width / 2;
      const my = e.clientY - rect.top - canvas.height / 2;
      panOffsetRef.current = {
        x: (1 - f) * mx + f * panOffsetRef.current.x,
        y: (1 - f) * my + f * panOffsetRef.current.y,
      };
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  // Resize canvas to container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const set = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    const observer = new ResizeObserver(set);
    observer.observe(canvas);
    set();
    return () => observer.disconnect();
  }, []);

  // Hit-test: find closest aircraft within 18px
  const hitTest = useCallback(
    (clientX: number, clientY: number): string | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      // Subtract pan offset so we're in the translated coordinate space
      const mx = clientX - rect.left - panOffsetRef.current.x;
      const my = clientY - rect.top - panOffsetRef.current.y;
      const effectiveRadius = radiusKmRef.current / zoomLevelRef.current;
      const hitRadius = 18 * Math.sqrt(zoomLevelRef.current);

      for (const ac of aircraftMap.values()) {
        if (!matchesFilter(ac, filtersRef.current)) continue;
        const pos = latLonToCanvas(
          ac._renderLat, ac._renderLon,
          latRef.current, lngRef.current, effectiveRadius,
          canvas.width, canvas.height
        );
        if (Math.hypot(mx - pos.x, my - pos.y) < hitRadius) return ac.hex;
      }
      return null;
    },
    [aircraftMap]
  );

  const hitTestAirport = useCallback(
    (clientX: number, clientY: number): Airport | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const mx = clientX - rect.left - panOffsetRef.current.x;
      const my = clientY - rect.top - panOffsetRef.current.y;
      const effectiveRadius = radiusKmRef.current / zoomLevelRef.current;
      return findClosestAirport(
        airportsRef.current,
        mx, my,
        latRef.current, lngRef.current,
        effectiveRadius,
        canvas.width, canvas.height
      );
    },
    []
  );

  return (
    <div className="radar-container">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'default' }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          const hitHex = hitTest(e.clientX, e.clientY);
          if (!hitHex) {
            isDraggingRef.current = true;
            e.currentTarget.style.cursor = 'grabbing';
            dragStartRef.current = {
              x: e.clientX - panOffsetRef.current.x,
              y: e.clientY - panOffsetRef.current.y,
            };
          }
        }}
        onMouseMove={(e) => {
          if (isDraggingRef.current) {
            panOffsetRef.current = {
              x: e.clientX - dragStartRef.current.x,
              y: e.clientY - dragStartRef.current.y,
            };
            return;
          }
          setHoverPos({ x: e.clientX, y: e.clientY });
          const hex = hitTest(e.clientX, e.clientY);
          setHovered(hex);
          if (!hex) {
            setHoveredAirport(hitTestAirport(e.clientX, e.clientY));
          } else {
            setHoveredAirport(null);
          }
        }}
        onMouseUp={(e) => {
          if (isDraggingRef.current) {
            isDraggingRef.current = false;
            e.currentTarget.style.cursor = 'default';
            return;
          }
          const hex = hitTest(e.clientX, e.clientY);
          if (hex) {
            if (pinTimeoutRef.current) clearTimeout(pinTimeoutRef.current);
            pinTimeoutRef.current = setTimeout(() => {
              pin(hex);
              pinTimeoutRef.current = null;
            }, 250);
          }
        }}
        onMouseLeave={(e) => {
          isDraggingRef.current = false;
          e.currentTarget.style.cursor = 'default';
          setHovered(null);
          setHoverPos(null);
          setHoveredAirport(null);
        }}
        onDoubleClick={() => {
          if (pinTimeoutRef.current) {
            clearTimeout(pinTimeoutRef.current);
            pinTimeoutRef.current = null;
          }
          zoomLevelRef.current = 1;
          panOffsetRef.current = { x: 0, y: 0 };
          setZoomScale(1);
        }}
      />

      {hoveredAircraft && hoverPos && !pinnedHexes.has(hoveredAircraft.hex) && (
        <FlightPreview aircraft={hoveredAircraft} x={hoverPos.x} y={hoverPos.y} scale={zoomScale} />
      )}

      {hoveredAirport && hoverPos && (
        <AirportPreview airport={hoveredAirport} x={hoverPos.x} y={hoverPos.y} />
      )}

      <div className="bubbles-container">
        {[...pinnedHexes].map((hex) => {
          const ac = aircraftMap.get(hex);
          if (!ac || !matchesFilter(ac, filters)) return null;
          const color = aircraftColor(ac.t, theme);
          return <FlightBubble key={hex} aircraft={ac} color={color} />;
        })}
      </div>
    </div>
  );
}
