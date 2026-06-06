import { describe, it, expect } from 'vitest';
import { applyPan, applyZoom } from './viewTransform';

describe('applyPan', () => {
  const base = { dLat: 0, dLon: 0 };
  // canvas 800×800, radius 100km → scale = 400/100 = 4px/km
  const W = 800, H = 800, radius = 100, lat = 0;

  it('dragging right (positive dx) decreases dLon', () => {
    const result = applyPan(base, 40, 0, lat, radius, W, H);
    expect(result.dLon).toBeLessThan(0);
  });

  it('dragging down (positive dy) increases dLat', () => {
    const result = applyPan(base, 0, 40, lat, radius, W, H);
    expect(result.dLat).toBeGreaterThan(0);
  });

  it('dragging right 40px at equator shifts lon by ~10km / 111 deg', () => {
    // kmPerPx = 100 / 400 = 0.25 km/px; dx=40 → 10 km → 10/111 ≈ 0.0901 deg
    const result = applyPan(base, 40, 0, 0, radius, W, H);
    expect(result.dLon).toBeCloseTo(-10 / 111, 3);
  });

  it('dragging down 44px shifts lat by ~11km / 111 deg', () => {
    // kmPerPx = 0.25 km/px; dy=44 → 11 km → 11/111 ≈ 0.099 deg
    const result = applyPan(base, 0, 44, 0, radius, W, H);
    expect(result.dLat).toBeCloseTo(11 / 111, 3);
  });

  it('accumulates correctly from non-zero starting offset', () => {
    const offset = { dLat: 1, dLon: -2 };
    const result = applyPan(offset, 0, 0, 0, radius, W, H);
    expect(result.dLat).toBeCloseTo(1, 5);
    expect(result.dLon).toBeCloseTo(-2, 5);
  });
});

describe('applyZoom', () => {
  const W = 800, H = 800;
  const centerLat = 0, centerLon = 0, radiusKm = 100;

  it('zooming in (negative deltaY) increases zoomLevel', () => {
    const result = applyZoom(1, { dLat: 0, dLon: 0 }, 0, 0, W, H, centerLat, centerLon, radiusKm, -100);
    expect(result.zoomLevel).toBeGreaterThan(1);
  });

  it('zooming out (positive deltaY) decreases zoomLevel', () => {
    const result = applyZoom(1, { dLat: 0, dLon: 0 }, 0, 0, W, H, centerLat, centerLon, radiusKm, 100);
    expect(result.zoomLevel).toBeLessThan(1);
  });

  it('zooming at canvas center (mx=0, my=0) does not change panOffset', () => {
    const result = applyZoom(1, { dLat: 0, dLon: 0 }, 0, 0, W, H, centerLat, centerLon, radiusKm, -200);
    expect(result.panOffset.dLat).toBeCloseTo(0, 5);
    expect(result.panOffset.dLon).toBeCloseTo(0, 5);
  });

  it('clamps zoomLevel to minimum 0.25', () => {
    const result = applyZoom(0.26, { dLat: 0, dLon: 0 }, 0, 0, W, H, centerLat, centerLon, radiusKm, 100000);
    expect(result.zoomLevel).toBeGreaterThanOrEqual(0.25);
  });

  it('clamps zoomLevel to maximum 20', () => {
    const result = applyZoom(19.9, { dLat: 0, dLon: 0 }, 0, 0, W, H, centerLat, centerLon, radiusKm, -100000);
    expect(result.zoomLevel).toBeLessThanOrEqual(20);
  });
});
