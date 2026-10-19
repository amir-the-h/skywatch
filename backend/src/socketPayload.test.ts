import { describe, it, expect } from 'vitest';
import { parseLocation } from './socketPayload';

describe('parseLocation', () => {
  it('accepts a valid payload', () => {
    expect(parseLocation({ lat: 51.47, lon: -0.45, radiusKm: 150 }, 500)).toEqual({
      lat: 51.47,
      lon: -0.45,
      radiusKm: 150,
    });
  });

  it('caps the radius', () => {
    expect(parseLocation({ lat: 0, lon: 0, radiusKm: 99999 }, 500)?.radiusKm).toBe(500);
  });

  it.each([
    ['null', null],
    ['a string', 'hello'],
    ['missing fields', {}],
    ['string lat', { lat: 'x', lon: 0, radiusKm: 10 }],
    ['NaN lon', { lat: 0, lon: NaN, radiusKm: 10 }],
    ['Infinity radius', { lat: 0, lon: 0, radiusKm: Infinity }],
    ['lat out of range', { lat: 91, lon: 0, radiusKm: 10 }],
    ['lon out of range', { lat: 0, lon: -181, radiusKm: 10 }],
    ['zero radius', { lat: 0, lon: 0, radiusKm: 0 }],
    ['negative radius', { lat: 0, lon: 0, radiusKm: -5 }],
  ])('rejects %s', (_label, payload) => {
    expect(parseLocation(payload, 500)).toBeNull();
  });
});
