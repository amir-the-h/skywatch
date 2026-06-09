import { describe, it, expect } from 'vitest';
import {
  haversineDistanceFt,
  bearingDeg,
  cardinalDir,
  elevationAngleDeg,
} from './lookAngles';

describe('haversineDistanceFt', () => {
  it('returns 0 for same point', () => {
    expect(haversineDistanceFt(0, 0, 0, 0)).toBe(0);
  });

  it('returns ~3648 ft for 0.01° longitude at equator', () => {
    // 0.01° ≈ 1111.95 m ≈ 3648 ft
    expect(haversineDistanceFt(0, 0, 0, 0.01)).toBeCloseTo(3648, 0);
  });
});

describe('bearingDeg', () => {
  it('north: (0,0) → (1,0) = 0°', () => {
    expect(bearingDeg(0, 0, 1, 0)).toBeCloseTo(0, 1);
  });

  it('east: (0,0) → (0,1) = 90°', () => {
    expect(bearingDeg(0, 0, 0, 1)).toBeCloseTo(90, 1);
  });

  it('south: (0,0) → (-1,0) = 180°', () => {
    expect(bearingDeg(0, 0, -1, 0)).toBeCloseTo(180, 1);
  });

  it('west: (0,0) → (0,-1) = 270°', () => {
    expect(bearingDeg(0, 0, 0, -1)).toBeCloseTo(270, 1);
  });
});

describe('cardinalDir', () => {
  it('0° → N', () => expect(cardinalDir(0)).toBe('N'));
  it('45° → NE', () => expect(cardinalDir(45)).toBe('NE'));
  it('90° → E', () => expect(cardinalDir(90)).toBe('E'));
  it('135° → SE', () => expect(cardinalDir(135)).toBe('SE'));
  it('180° → S', () => expect(cardinalDir(180)).toBe('S'));
  it('270° → W', () => expect(cardinalDir(270)).toBe('W'));
  it('337.5° → NNW', () => expect(cardinalDir(337.5)).toBe('NNW'));
  it('359° → N (wraps)', () => expect(cardinalDir(359)).toBe('N'));
});

describe('elevationAngleDeg', () => {
  it('same altitude → 0°', () => {
    expect(elevationAngleDeg(1000, 1000, 5000)).toBeCloseTo(0, 5);
  });

  it('45° when alt delta equals distance', () => {
    expect(elevationAngleDeg(0, 10000, 10000)).toBeCloseTo(45, 1);
  });

  it('negative angle when aircraft is below observer', () => {
    // observer=5000, aircraft=1000 → Δalt=-4000, dist=5000 → atan2(-4000,5000) ≈ -38.66°
    expect(elevationAngleDeg(5000, 1000, 5000)).toBeCloseTo(-38.66, 1);
  });
});
