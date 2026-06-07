import { describe, it, expect } from 'vitest';
import { iconScaleForZoom, screenPosToCull } from './zoomScale';

describe('iconScaleForZoom', () => {
  it('returns 1 at zoom level 1', () => {
    expect(iconScaleForZoom(1)).toBe(1);
  });

  it('returns 2 at zoom level 4', () => {
    expect(iconScaleForZoom(4)).toBeCloseTo(2, 5);
  });

  it('returns 3 at zoom level 9', () => {
    expect(iconScaleForZoom(9)).toBeCloseTo(3, 5);
  });
});

describe('screenPosToCull', () => {
  it('returns true when aircraft is off-screen to the left (no pan)', () => {
    expect(screenPosToCull(-30, 200, 0, 0, 800, 600, 20)).toBe(true);
  });

  it('returns false when aircraft is visible with no pan', () => {
    expect(screenPosToCull(400, 300, 0, 0, 800, 600, 20)).toBe(false);
  });

  it('returns false when aircraft is off raw canvas but panned into view', () => {
    // pos.x = -200, panOffset.x = 300 → screenX = 100 (visible)
    expect(screenPosToCull(-200, 300, 300, 0, 800, 600, 20)).toBe(false);
  });

  it('returns true when aircraft is on raw canvas but panned out of view', () => {
    // pos.x = 100, panOffset.x = -500 → screenX = -400 (off-screen)
    expect(screenPosToCull(100, 300, -500, 0, 800, 600, 20)).toBe(true);
  });
});
