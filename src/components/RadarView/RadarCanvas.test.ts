// src/components/RadarView/RadarCanvas.test.ts
// LABEL_W=100, LABEL_H=52 are private constants in RadarCanvas.ts — hardcoded here accordingly
const LABEL_HALF_W = 50;  // LABEL_W / 2
const LABEL_HALF_H = 26;  // LABEL_H / 2

import { describe, it, expect, beforeEach } from 'vitest';
import { computeLabelPositions, resetLabelState, drawHeadingLabels } from './RadarCanvas';
import type { RadarDrawParams } from './RadarCanvas';
import type { Aircraft, LabelCondition } from '../../types/aircraft';

function ac(hex: string, overrides: Partial<Aircraft> = {}): Aircraft {
  return {
    hex, flight: hex.toUpperCase(), r: 'N1', t: 'B738',
    lat: 41, lon: 28, alt_baro: 35000, gs: 480, track: 0,
    baro_rate: 0, seen: 1, phase: 'CRZ', pathHistory: [],
    _renderLat: 41, _renderLon: 28, _lastSeen: 0,
    ...overrides,
  };
}

function makeRenderData(...entries: Array<[string, number, number]>) {
  return new Map(entries.map(([hex, x, y]) => [hex, { pos: { x, y }, color: '#ffffff' }]));
}

// assumes both rects have the same w×h (both are LABEL_W×LABEL_H)
function overlapArea(ax: number, ay: number, bx: number, by: number, w: number, h: number): number {
  const ix = Math.max(0, Math.min(ax + w, bx + w) - Math.max(ax, bx));
  const iy = Math.max(0, Math.min(ay + h, by + h) - Math.max(ay, by));
  return ix * iy;
}

const BASE: {
  width: number; height: number; pinnedHexes: Set<string>;
  labelConditions: LabelCondition[]; panOffset: { x: number; y: number }; zoomLevel: number;
} = {
  width: 800, height: 600,
  pinnedHexes: new Set(),
  labelConditions: ['always'],
  panOffset: { x: 0, y: 0 },
  zoomLevel: 1,
};

describe('computeLabelPositions', () => {
  beforeEach(() => resetLabelState());

  describe('single aircraft', () => {
    it('returns a placement for the visible aircraft', () => {
      const result = computeLabelPositions(
        { ...BASE, aircraft: [ac('abc')] },
        makeRenderData(['abc', 400, 300]),
        1,
      );
      expect(result.has('abc')).toBe(true);
    });

    it('places the label to the upper-right on first frame', () => {
      const result = computeLabelPositions(
        { ...BASE, aircraft: [ac('abc')] },
        makeRenderData(['abc', 400, 300]),
        1,
      );
      const p = result.get('abc')!;
      // upper-right: label center-x > aircraft x, label center-y < aircraft y
      expect(p.lx + LABEL_HALF_W).toBeGreaterThan(400);
      expect(p.ly + LABEL_HALF_H).toBeLessThan(300);
    });

    it('returns full opacity when no overlap', () => {
      const result = computeLabelPositions(
        { ...BASE, aircraft: [ac('abc')] },
        makeRenderData(['abc', 400, 300]),
        1,
      );
      expect(result.get('abc')!.opacity).toBeCloseTo(1, 1);
    });
  });

  describe('two aircraft at the same position', () => {
    it('places them in different slots so overlap is below 50%', () => {
      const result = computeLabelPositions(
        { ...BASE, aircraft: [ac('aaa'), ac('bbb')] },
        makeRenderData(['aaa', 400, 300], ['bbb', 400, 300]),
        1,
      );
      const a = result.get('aaa')!;
      const b = result.get('bbb')!;
      const overlap = overlapArea(a.lx, a.ly, b.lx, b.ly, 100, 52);
      expect(overlap).toBeLessThan(100 * 52 * 0.5);
    });
  });

  describe('priority: pinned before normal', () => {
    it('gives the pinned aircraft the preferred upper-right slot', () => {
      const result = computeLabelPositions(
        { ...BASE, aircraft: [ac('normal'), ac('pinned')], pinnedHexes: new Set(['pinned']) },
        makeRenderData(['normal', 400, 300], ['pinned', 400, 300]),
        1,
      );
      const pinned = result.get('pinned')!;
      // Pinned gets upper-right: label center right of aircraft, above aircraft
      expect(pinned.lx + LABEL_HALF_W).toBeGreaterThan(400);
      expect(pinned.ly + LABEL_HALF_H).toBeLessThan(300);
    });
  });

  describe('canvas edge avoidance', () => {
    it('does not place label outside canvas bounds when aircraft is near top-left corner', () => {
      const result = computeLabelPositions(
        { ...BASE, aircraft: [ac('edge')] },
        makeRenderData(['edge', 5, 5]),
        1,
      );
      const p = result.get('edge')!;
      expect(p.lx).toBeGreaterThanOrEqual(0);
      expect(p.ly).toBeGreaterThanOrEqual(0);
    });

    it('does not place label outside canvas bounds when aircraft is near bottom-right corner', () => {
      const result = computeLabelPositions(
        { ...BASE, aircraft: [ac('edge-br')] },
        makeRenderData(['edge-br', 795, 595]),
        1,
      );
      const p = result.get('edge-br')!;
      expect(p.lx + 100).toBeLessThanOrEqual(800);
      expect(p.ly + 52).toBeLessThanOrEqual(600);
    });
  });

  it('gives at least two labels reduced opacity when 10 aircraft share the same spot', () => {
    const hexes = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    const aircraft = hexes.map(h => ac(h));
    const renderData = makeRenderData(...hexes.map(h => [h, 400, 300] as [string, number, number]));
    const result = computeLabelPositions({ ...BASE, aircraft }, renderData, 1);
    const opacities = [...result.values()].map(p => p.opacity);
    expect(opacities.filter(o => o < 1).length).toBeGreaterThanOrEqual(2);
  });

  describe('omits aircraft with no render data', () => {
    it('does not include aircraft missing from renderData', () => {
      const result = computeLabelPositions(
        { ...BASE, aircraft: [ac('missing')] },
        new Map(),
        1,
      );
      expect(result.has('missing')).toBe(false);
    });
  });

  describe('lerp: new aircraft initialise at target', () => {
    it('returns same position on frame 1 and frame 2 for a stationary aircraft', () => {
      const aircraft = [ac('stable')];
      const renderData = makeRenderData(['stable', 400, 300]);
      const r1 = computeLabelPositions({ ...BASE, aircraft }, renderData, 1);
      // New aircraft snap to target on first frame (no lerp), so position is identical on frame 2
      const r2 = computeLabelPositions({ ...BASE, aircraft }, renderData, 1);
      expect(r1.get('stable')!.lx).toBe(r2.get('stable')!.lx);
      expect(r1.get('stable')!.ly).toBe(r2.get('stable')!.ly);
    });
  });

  describe('lerp: stale entries are removed', () => {
    it('does not include a gone aircraft in the next frame result', () => {
      computeLabelPositions(
        { ...BASE, aircraft: [ac('gone')] },
        makeRenderData(['gone', 400, 300]),
        1,
      );
      const r2 = computeLabelPositions({ ...BASE, aircraft: [] }, new Map(), 1);
      expect(r2.has('gone')).toBe(false);
    });
  });
});

function makeCtx() {
  const calls: Array<{ text: string; font: string }> = [];
  let currentFont = '';
  return {
    ctx: {
      save: () => {},
      restore: () => {},
      fillText: (text: string, _x: number, _y: number) => calls.push({ text, font: currentFont }),
      get font() { return currentFont; },
      set font(v: string) { currentFont = v; },
      set fillStyle(_: unknown) {},
      set textAlign(_: unknown) {},
      set textBaseline(_: unknown) {},
    } as unknown as CanvasRenderingContext2D,
    calls,
  };
}

const BASE_HEADING = { width: 800, height: 600 } as unknown as RadarDrawParams;

describe('drawHeadingLabels', () => {
  it('emits all 12 compass labels', () => {
    const { ctx, calls } = makeCtx();
    drawHeadingLabels({ ...BASE_HEADING, ctx });
    const texts = calls.map(c => c.text);
    expect(texts).toContain('N');
    expect(texts).toContain('E');
    expect(texts).toContain('S');
    expect(texts).toContain('W');
    expect(texts).toContain('30');
    expect(texts).toContain('60');
    expect(texts).toContain('120');
    expect(texts).toContain('150');
    expect(texts).toContain('210');
    expect(texts).toContain('240');
    expect(texts).toContain('300');
    expect(texts).toContain('330');
    expect(calls).toHaveLength(12);
  });

  it('renders N, E, S, W in bold', () => {
    const { ctx, calls } = makeCtx();
    drawHeadingLabels({ ...BASE_HEADING, ctx });
    for (const label of ['N', 'E', 'S', 'W']) {
      const call = calls.find(c => c.text === label)!;
      expect(call.font).toMatch(/bold/);
    }
  });

  it('renders numeric labels without bold', () => {
    const { ctx, calls } = makeCtx();
    drawHeadingLabels({ ...BASE_HEADING, ctx });
    for (const label of ['30', '60', '120', '150', '210', '240', '300', '330']) {
      const call = calls.find(c => c.text === label)!;
      expect(call.font).not.toMatch(/bold/);
    }
  });
});
