import { describe, it, expect } from 'vitest';
import { snapToGrid, cellKey } from './GridEngine';

describe('snapToGrid', () => {
  it('returns consistent snapped coords for nearby points', () => {
    const a = snapToGrid(41.00, 28.97);
    const b = snapToGrid(41.01, 28.97);
    expect(cellKey(a.gLat, a.gLon)).toBe(cellKey(b.gLat, b.gLon));
  });

  it('returns different cell keys for distant points', () => {
    const a = snapToGrid(41.0, 28.0);
    const b = snapToGrid(42.0, 29.0);
    expect(cellKey(a.gLat, a.gLon)).not.toBe(cellKey(b.gLat, b.gLon));
  });

  it('cellKey is deterministic for same input', () => {
    const { gLat, gLon } = snapToGrid(51.5, -0.12);
    expect(cellKey(gLat, gLon)).toBe(cellKey(gLat, gLon));
  });

  it('cellKey contains no floating point noise', () => {
    const { gLat, gLon } = snapToGrid(41.0082, 28.9784);
    const key = cellKey(gLat, gLon);
    expect(key).toMatch(/^-?\d+\.\d{4}:-?\d+\.\d{4}$/);
  });
});
