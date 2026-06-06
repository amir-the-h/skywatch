// src/components/RadarView/RadarView.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAircraftStore } from '../../store/aircraftStore';
import { useSettingsStore } from '../../hooks/useSettings';
import { interpolatePosition } from '../../lib/interpolate';
import { drawRadar } from './RadarCanvas';
import { FlightBubble } from '../FlightBubble/FlightBubble';
import { FlightPreview } from '../FlightBubble/FlightPreview';
import { latLonToCanvas } from '../../lib/geoUtils';
import { applyPan, applyZoom, type PanOffset } from './viewTransform';

export function RadarView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const { lat, lng, radiusKm, ringIntervals, theme } = useSettingsStore();
  const aircraftMap = useAircraftStore((s) => s.aircraft);
  const pinnedHexes = useAircraftStore((s) => s.pinnedHexes);
  const hoveredHex = useAircraftStore((s) => s.hoveredHex);
  const pin = useAircraftStore((s) => s.pin);
  const setHovered = useAircraftStore((s) => s.setHovered);

  // Refs so the rAF loop reads fresh hover/pin state without restarting on every hover
  const hoveredHexRef = useRef(hoveredHex);
  const pinnedHexesRef = useRef(pinnedHexes);
  useEffect(() => { hoveredHexRef.current = hoveredHex; }, [hoveredHex]);
  useEffect(() => { pinnedHexesRef.current = pinnedHexes; }, [pinnedHexes]);

  const panOffsetRef = useRef<PanOffset>({ dLat: 0, dLon: 0 });
  const zoomLevelRef = useRef(1);

  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);
  const [cursor, setCursor] = useState<'grab' | 'grabbing'>('grab');

  // Mirror settings into refs so stable wheel/drag callbacks read fresh values
  const latRef = useRef(lat);
  const lngRef = useRef(lng);
  const radiusKmRef = useRef(radiusKm);
  useEffect(() => {
    latRef.current = lat;
    lngRef.current = lng;
    radiusKmRef.current = radiusKm;
  }, [lat, lng, radiusKm]);

  // Reset pan/zoom whenever the user changes settings
  useEffect(() => {
    panOffsetRef.current = { dLat: 0, dLon: 0 };
    zoomLevelRef.current = 1;
  }, [lat, lng, radiusKm]);

  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const hoveredAircraft = hoveredHex ? aircraftMap.get(hoveredHex) : null;

  // rAF draw loop — only restarts when settings or aircraft data changes, not on hover
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      const now = Date.now();
      const aircraft = Array.from(aircraftMap.values()).map((ac) =>
        interpolatePosition(ac, now)
      );
      const effectiveLat = latRef.current + panOffsetRef.current.dLat;
      const effectiveLon = lngRef.current + panOffsetRef.current.dLon;
      const effectiveRadius = radiusKmRef.current / zoomLevelRef.current;
      drawRadar({
        ctx,
        width: canvas.width,
        height: canvas.height,
        centerLat: effectiveLat,
        centerLon: effectiveLon,
        radiusKm: effectiveRadius,
        ringIntervals,
        aircraft,
        hoveredHex: hoveredHexRef.current,
        pinnedHexes: pinnedHexesRef.current,
        theme,
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
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left - canvas.width / 2;
      const my = e.clientY - rect.top - canvas.height / 2;
      const result = applyZoom(
        zoomLevelRef.current,
        panOffsetRef.current,
        mx, my,
        canvas.width, canvas.height,
        latRef.current, lngRef.current, radiusKmRef.current,
        e.deltaY
      );
      zoomLevelRef.current = result.zoomLevel;
      panOffsetRef.current = result.panOffset;
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
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      const effectiveLat = latRef.current + panOffsetRef.current.dLat;
      const effectiveLon = lngRef.current + panOffsetRef.current.dLon;
      const effectiveRadius = radiusKmRef.current / zoomLevelRef.current;

      for (const ac of aircraftMap.values()) {
        const pos = latLonToCanvas(
          ac._renderLat, ac._renderLon,
          effectiveLat, effectiveLon, effectiveRadius,
          canvas.width, canvas.height
        );
        if (Math.hypot(mx - pos.x, my - pos.y) < 18) return ac.hex;
      }
      return null;
    },
    [aircraftMap]
  );

  return (
    <div className="radar-container">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor }}
        onMouseDown={(e) => {
          isDragging.current = true;
          hasMoved.current = false;
          dragStart.current = { x: e.clientX, y: e.clientY };
          setCursor('grabbing');
        }}
        onMouseMove={(e) => {
          if (isDragging.current) {
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;
            if (!hasMoved.current && Math.hypot(dx, dy) < 4) return;
            hasMoved.current = true;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const effectiveLat = latRef.current + panOffsetRef.current.dLat;
            const effectiveRadius = radiusKmRef.current / zoomLevelRef.current;
            panOffsetRef.current = applyPan(
              panOffsetRef.current,
              dx, dy,
              effectiveLat, effectiveRadius,
              canvas.width, canvas.height
            );
            dragStart.current = { x: e.clientX, y: e.clientY };
            return;
          }
          setHoverPos({ x: e.clientX, y: e.clientY });
          setHovered(hitTest(e.clientX, e.clientY));
        }}
        onMouseUp={(e) => {
          const wasDrag = hasMoved.current;
          isDragging.current = false;
          hasMoved.current = false;
          setCursor('grab');
          if (!wasDrag) {
            const hex = hitTest(e.clientX, e.clientY);
            if (hex) pin(hex);
          }
        }}
        onMouseLeave={() => {
          isDragging.current = false;
          hasMoved.current = false;
          setCursor('grab');
          setHovered(null);
        }}
        onDoubleClick={() => {
          panOffsetRef.current = { dLat: 0, dLon: 0 };
          zoomLevelRef.current = 1;
        }}
      />

      {hoveredAircraft && hoverPos && !pinnedHexes.has(hoveredAircraft.hex) && (
        <FlightPreview aircraft={hoveredAircraft} x={hoverPos.x} y={hoverPos.y} />
      )}

      <div className="bubbles-container">
        {[...pinnedHexes].map((hex) => {
          const ac = aircraftMap.get(hex);
          return ac ? <FlightBubble key={hex} aircraft={ac} /> : null;
        })}
      </div>
    </div>
  );
}
