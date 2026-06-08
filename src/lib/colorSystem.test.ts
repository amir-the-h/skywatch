import { describe, it, expect } from 'vitest';
import { aircraftColor, getManufacturer, lightenHsl } from './colorSystem';

describe('getManufacturer', () => {
  it('maps Boeing type codes', () => {
    expect(getManufacturer('B738')).toBe('Boeing');
    expect(getManufacturer('B77W')).toBe('Boeing');
  });

  it('maps Airbus type codes', () => {
    expect(getManufacturer('A320')).toBe('Airbus');
    expect(getManufacturer('A350')).toBe('Airbus');
  });

  it('maps Bombardier CRJ codes', () => {
    expect(getManufacturer('CRJ9')).toBe('Bombardier');
  });

  it('falls back to first 3 chars for unknown types', () => {
    expect(getManufacturer('XYZ1')).toBe('XYZ');
  });
});

describe('aircraftColor', () => {
  it('returns a valid hsl string', () => {
    const color = aircraftColor('B738');
    expect(color).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/);
  });

  it('is deterministic — same type gives same color', () => {
    expect(aircraftColor('A320')).toBe(aircraftColor('A320'));
  });

  it('same manufacturer → same hue family', () => {
    const hue = (color: string) => parseInt(color.match(/hsl\((\d+)/)![1]);
    expect(hue(aircraftColor('B738'))).toBe(hue(aircraftColor('B77W')));
  });
});

describe('lightenHsl', () => {
  it('increases lightness by the given fraction', () => {
    const result = lightenHsl('hsl(120, 90%, 55%)', 0.2);
    expect(result).toBe('hsl(120, 90%, 75%)');
  });

  it('clamps lightness at 100%', () => {
    const result = lightenHsl('hsl(120, 90%, 95%)', 0.2);
    expect(result).toBe('hsl(120, 90%, 100%)');
  });

  it('returns the input unchanged if not a valid hsl string', () => {
    expect(lightenHsl('not-a-color', 0.2)).toBe('not-a-color');
  });

  it('produces a valid hsl string for aircraft colors', () => {
    const base = aircraftColor('B738');
    const bright = lightenHsl(base, 0.2);
    expect(bright).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/);
  });
});
