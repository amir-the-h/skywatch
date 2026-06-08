// src/components/RadarView/RadarView.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAircraftStore } from '../../store/aircraftStore';
import { useSettingsStore } from '../../hooks/useSettings';
import { interpolatePosition } from '../../lib/interpolate';
import { aircraftColor } from '../../lib/colorSystem';
import { drawRadar, resetLabelState } from './RadarCanvas';
import { FlightBubble } from '../FlightBubble/FlightBubble';
import { FlightPreview } from '../FlightBubble/FlightPreview';
import { latLonToCanvas } from '../../lib/geoUtils';
import { applyZoom } from './viewTransform';
import { useFilterStore } from '../../store/filterStore';
import { matchesFilter } from '../../lib/aircraftFilter';
import { useAirports } from '../../hooks/useAirports';
import { useMetar } from '../../hooks/useMetar';
import { findClosestAirport } from '../../lib/geoUtils';
import { AirportPreview } from './AirportPreview';
import type { Airport, MetarData } from '../../../../shared/types';

export function RadarView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const { lat, lng, radiusKm, ringIntervals, trailLength, labelConditions } = useSettingsStore();
  const aircraftMap = useAircraftStore((s) => s.aircraft);
  const pinnedHexes = useAircraftStore((s) => s.pinnedHexes);
  const hoveredHex = useAircraftStore((s) => s.hoveredHex);
  const pin = useAircraftStore((s) => s.pin);
  const unpin = useAircraftStore((s) => s.unpin);
  const setHovered = useAircraftStore((s) => s.setHovered);

  const hoveredHexRef = useRef(hoveredHex);
  const pinnedHexesRef = useRef(pinnedHexes);
  const aircraftMapRef = useRef(aircraftMap);
  useEffect(() => { hoveredHexRef.current = hoveredHex; }, [hoveredHex]);
  useEffect(() => { pinnedHexesRef.current = pinnedHexes; }, [pinnedHexes]);
  useEffect(() => { aircraftMapRef.current = aircraftMap; }, [aircraftMap]);

  const zoomLevelRef = useRef(1);
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const pinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDistRef = useRef<number | null>(null);
  const hadPinchRef = useRef(false);

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

  const airports = useAirports();
  const airportsRef = useRef<Airport[]>([]);
  useEffect(() => { airportsRef.current = airports; }, [airports]);

  const metar = useMetar();
  const metarRef = useRef<Map<string, MetarData>>(new Map());
  useEffect(() => { metarRef.current = metar; }, [metar]);

  const [hoveredAirport, setHoveredAirport] = useState<Airport | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [isTransformed, setIsTransformed] = useState(false);

  const resetView = useCallback(() => {
    resetLabelState();
    zoomLevelRef.current = 1;
    panOffsetRef.current = { x: 0, y: 0 };
    setZoomScale(1);
    setIsTransformed(false);
  }, []);

  // Reset zoom and pan when radius changes
  useEffect(() => {
    resetView();
  }, [radiusKm, resetView]);

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
      const allAircraft = Array.from(aircraftMapRef.current.values()).map((ac) =>
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
        panOffset: panOffsetRef.current,
        trailLength: trailLengthRef.current,
        labelConditions: labelConditionsRef.current,
        airports: airportsRef.current,
        zoomLevel: zoomLevelRef.current,
        metar: metarRef.current,
      });
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      resetLabelState();
    };
  }, [lat, lng, radiusKm, ringIntervals]);

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
      setIsTransformed(true);
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
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'default', touchAction: 'none' }}
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
            setIsTransformed(true);
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
            setIsTransformed(
              panOffsetRef.current.x !== 0 ||
              panOffsetRef.current.y !== 0 ||
              zoomLevelRef.current !== 1,
            );
            return;
          }
          const hex = hitTest(e.clientX, e.clientY);
          if (hex) {
            if (pinTimeoutRef.current) clearTimeout(pinTimeoutRef.current);
            pinTimeoutRef.current = setTimeout(() => {
              if (pinnedHexesRef.current.has(hex)) {
                unpin(hex);
              } else {
                pin(hex);
              }
              pinTimeoutRef.current = null;
            }, 250);
          }
        }}
        onMouseLeave={(e) => {
          if (isDraggingRef.current) {
            setIsTransformed(
              panOffsetRef.current.x !== 0 ||
              panOffsetRef.current.y !== 0 ||
              zoomLevelRef.current !== 1,
            );
          }
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
          resetView();
        }}
        onTouchStart={(e) => {
          if (e.touches.length === 1) {
            const t = e.touches[0];
            isDraggingRef.current = true;
            hadPinchRef.current = false;
            dragStartRef.current = {
              x: t.clientX - panOffsetRef.current.x,
              y: t.clientY - panOffsetRef.current.y,
            };
            touchStartRef.current = { x: t.clientX, y: t.clientY };
          } else if (e.touches.length === 2) {
            isDraggingRef.current = false;
            hadPinchRef.current = true;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastPinchDistRef.current = Math.hypot(dx, dy);
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 1 && isDraggingRef.current) {
            const t = e.touches[0];
            panOffsetRef.current = {
              x: t.clientX - dragStartRef.current.x,
              y: t.clientY - dragStartRef.current.y,
            };
            setIsTransformed(true);
          } else if (e.touches.length === 2 && lastPinchDistRef.current !== null) {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const newDist = Math.hypot(dx, dy);
            const delta = (lastPinchDistRef.current - newDist) * 2;
            lastPinchDistRef.current = newDist;
            const oldZoom = zoomLevelRef.current;
            zoomLevelRef.current = applyZoom(oldZoom, delta);
            setZoomScale(Math.sqrt(zoomLevelRef.current));
            const rect = canvas.getBoundingClientRect();
            const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left - canvas.width / 2;
            const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top - canvas.height / 2;
            const f = zoomLevelRef.current / oldZoom;
            panOffsetRef.current = {
              x: (1 - f) * mx + f * panOffsetRef.current.x,
              y: (1 - f) * my + f * panOffsetRef.current.y,
            };
            setIsTransformed(true);
          }
        }}
        onTouchEnd={(e) => {
          e.preventDefault(); // prevent synthesized mouseup/click from double-firing pin/unpin
          if (e.touches.length === 0) {
            // All fingers lifted — check for tap
            if (isDraggingRef.current && touchStartRef.current && !hadPinchRef.current) {
              const t = e.changedTouches[0];
              const moved = Math.hypot(
                t.clientX - touchStartRef.current.x,
                t.clientY - touchStartRef.current.y,
              );
              if (moved < 8) {
                const hex = hitTest(t.clientX, t.clientY);
                if (hex) {
                  if (pinnedHexesRef.current.has(hex)) {
                    unpin(hex);
                  } else {
                    pin(hex);
                  }
                }
              }
            }
            isDraggingRef.current = false;
            touchStartRef.current = null;
            lastPinchDistRef.current = null;
            hadPinchRef.current = false;
          } else if (e.touches.length === 1) {
            // One finger lifted, one still down — avoid pan jump
            lastPinchDistRef.current = null;
            const remaining = e.touches[0];
            dragStartRef.current = {
              x: remaining.clientX - panOffsetRef.current.x,
              y: remaining.clientY - panOffsetRef.current.y,
            };
            touchStartRef.current = { x: remaining.clientX, y: remaining.clientY };
            isDraggingRef.current = true;
          }
        }}
      />

      {hoveredAircraft && hoverPos && !pinnedHexes.has(hoveredAircraft.hex) && (
        <FlightPreview aircraft={hoveredAircraft} x={hoverPos.x} y={hoverPos.y} scale={zoomScale} />
      )}

      {hoveredAirport && hoverPos && (
        <AirportPreview airport={hoveredAirport} x={hoverPos.x} y={hoverPos.y} metar={metar.get(hoveredAirport.icao)} />
      )}

      <div className="bubbles-container">
        {[...pinnedHexes].map((hex) => {
          const ac = aircraftMap.get(hex);
          if (!ac || !matchesFilter(ac, filters)) return null;
          const color = aircraftColor(ac.t);
          return <FlightBubble key={hex} aircraft={ac} color={color} />;
        })}
      </div>

      {isTransformed && (
        <button
          className="icon-btn radar-reset-btn"
          onClick={resetView}
          title="Reset view"
        >
          ⌖
        </button>
      )}
    </div>
  );
}
