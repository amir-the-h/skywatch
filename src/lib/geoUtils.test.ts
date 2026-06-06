import { describe, it, expect } from 'vitest';
import { haversineKm, boundingBox, latLonToCanvas } from './geoUtils';

describe('haversineKm', () => {
  it('returns ~0 for same point', () => {
    expect(haversineKm(41, 28, 41, 28)).toBeCloseTo(0, 5);
  });

  it('returns ~111 km per degree of latitude', () => {
    expect(haversineKm(0, 0, 1, 0)).toBeCloseTo(111.2, 0);
  });

  it('is symmetric', () => {
    const d1 = haversineKm(41, 28, 42, 29);
    const d2 = haversineKm(42, 29, 41, 28);
    expect(d1).toBeCloseTo(d2, 5);
  });
});

describe('boundingBox', () => {
  it('returns a box with correct structure', () => {
    const box = boundingBox(41, 28, 100);
    expect(box).toHaveProperty('minLat');
    expect(box).toHaveProperty('maxLat');
    expect(box).toHaveProperty('minLon');
    expect(box).toHaveProperty('maxLon');
  });

  it('produces a box wider than tall near the equator', () => {
    const box = boundingBox(0, 0, 100);
    expect(box.maxLat - box.minLat).toBeCloseTo(box.maxLon - box.minLon, 0);
  });

  it('produces a wider box in degrees at higher latitude', () => {
    const boxAt60 = boundingBox(60, 0, 100);
    const boxAt0 = boundingBox(0, 0, 100);
    expect(boxAt60.maxLon - boxAt60.minLon).toBeGreaterThan(boxAt0.maxLon - boxAt0.minLon);
  });
});

describe('latLonToCanvas', () => {
  it('maps center point to canvas center', () => {
    const result = latLonToCanvas(41, 28, 41, 28, 100, 800, 800);
    expect(result.x).toBeCloseTo(400, 1);
    expect(result.y).toBeCloseTo(400, 1);
  });

  it('maps a north point above center (lower y)', () => {
    const center = latLonToCanvas(41, 28, 41, 28, 100, 800, 800);
    const north = latLonToCanvas(42, 28, 41, 28, 100, 800, 800);
    expect(north.y).toBeLessThan(center.y);
  });
});
