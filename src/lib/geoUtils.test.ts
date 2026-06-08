import { describe, it, expect } from 'vitest';
import type { Airport } from '../../../shared/types';
import { haversineKm, boundingBox, latLonToCanvas, bearingToLatLon, findClosestAirport } from './geoUtils';

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

describe('bearingToLatLon', () => {
  it('returns the same point for distance 0', () => {
    const result = bearingToLatLon(41, 28, 90, 0);
    expect(result.lat).toBeCloseTo(41, 5);
    expect(result.lon).toBeCloseTo(28, 5);
  });

  it('heading north moves latitude up', () => {
    const result = bearingToLatLon(41, 28, 0, 111);
    expect(result.lat).toBeCloseTo(42, 0);
    expect(result.lon).toBeCloseTo(28, 0);
  });

  it('heading east moves longitude right', () => {
    const result = bearingToLatLon(0, 0, 90, 111);
    expect(result.lon).toBeGreaterThan(0);
    expect(result.lat).toBeCloseTo(0, 0);
  });

  it('result is ~distanceKm away from origin', () => {
    const result = bearingToLatLon(41, 28, 45, 50);
    expect(haversineKm(41, 28, result.lat, result.lon)).toBeCloseTo(50, 0);
  });
});

// Canvas: 800×800, center at (0,0), radiusKm=100
// latLonToCanvas(0,0, 0,0, 100, 800, 800) → {x:400, y:400}
const CENTER_LAT = 0;
const CENTER_LON = 0;
const RADIUS_KM = 100;
const W = 800;
const H = 800;

function makeAirport(lat: number, lon: number): Airport {
  return { icao: 'TEST', iata: '', name: 'Test', lat, lon, type: 'large_airport', runways: [] };
}

describe('findClosestAirport', () => {
  it('returns airport when mouse is within 18px of its canvas position', () => {
    const airports = [makeAirport(0, 0)]; // maps to (400, 400)
    // Mouse at (405, 405) — distance ≈ 7px
    const result = findClosestAirport(airports, 405, 405, CENTER_LAT, CENTER_LON, RADIUS_KM, W, H);
    expect(result).not.toBeNull();
    expect(result?.icao).toBe('TEST');
  });

  it('returns null when mouse is farther than 18px', () => {
    const airports = [makeAirport(0, 0)]; // maps to (400, 400)
    // Mouse at (450, 450) — distance ≈ 70px
    const result = findClosestAirport(airports, 450, 450, CENTER_LAT, CENTER_LON, RADIUS_KM, W, H);
    expect(result).toBeNull();
  });

  it('returns null for empty airports array', () => {
    const result = findClosestAirport([], 400, 400, CENTER_LAT, CENTER_LON, RADIUS_KM, W, H);
    expect(result).toBeNull();
  });

  it('returns the closest airport when multiple are nearby', () => {
    const airports = [
      makeAirport(0, 0),    // maps to (400, 400) — distance 5px from mouse
      makeAirport(0.001, 0), // maps slightly above center — farther from mouse
    ];
    const result = findClosestAirport(airports, 405, 400, CENTER_LAT, CENTER_LON, RADIUS_KM, W, H);
    expect(result?.lat).toBeCloseTo(0, 5);
  });
});
