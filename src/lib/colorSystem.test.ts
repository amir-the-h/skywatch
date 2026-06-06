import { describe, it, expect } from 'vitest';
import { aircraftColor, getManufacturer } from './colorSystem';

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
    const color = aircraftColor('B738', 'dark');
    expect(color).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/);
  });

  it('is deterministic — same type gives same color', () => {
    expect(aircraftColor('A320', 'dark')).toBe(aircraftColor('A320', 'dark'));
  });

  it('same manufacturer → same hue family', () => {
    const hue = (color: string) => parseInt(color.match(/hsl\((\d+)/)![1]);
    expect(hue(aircraftColor('B738', 'dark'))).toBe(hue(aircraftColor('B77W', 'dark')));
  });

  it('dark theme uses higher lightness than light theme', () => {
    const lightness = (color: string) => parseInt(color.match(/(\d+)%\)$/)![1]);
    expect(lightness(aircraftColor('A320', 'dark'))).toBeGreaterThan(
      lightness(aircraftColor('A320', 'light'))
    );
  });
});
