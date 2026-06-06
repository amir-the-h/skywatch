import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAircraft } from './airplanesLive';

const MOCK_RESPONSE = {
  ac: [
    {
      hex: 'abc123',
      flight: 'TK1 ',
      r: 'TC-JSM',
      t: 'B738',
      lat: 41.0,
      lon: 28.0,
      alt_baro: 35000,
      gs: 450,
      track: 180,
      baro_rate: -500,
      squawk: '1234',
      seen: 2,
    },
    {
      // missing lat/lon — should be filtered out
      hex: 'bad000',
      flight: 'XX9',
      t: 'A320',
      seen: 1,
    },
  ],
  total: 2,
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_RESPONSE,
    })
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchAircraft', () => {
  it('calls the correct URL with NM radius', async () => {
    await fetchAircraft(41, 28, 100);
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toMatch(/\/v2\/point\/41\/28\/\d+/);
  });

  it('normalizes and returns valid aircraft', async () => {
    const result = await fetchAircraft(41, 28, 100);
    expect(result).toHaveLength(1);
    expect(result[0].hex).toBe('abc123');
    expect(result[0].flight).toBe('TK1');
  });

  it('initializes _renderLat/_renderLon to lat/lon', async () => {
    const result = await fetchAircraft(41, 28, 100);
    expect(result[0]._renderLat).toBe(41.0);
    expect(result[0]._renderLon).toBe(28.0);
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) })
    );
    await expect(fetchAircraft(41, 28, 100)).rejects.toThrow('429');
  });
});
