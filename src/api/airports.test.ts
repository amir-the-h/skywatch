import { describe, it, expect, vi, beforeEach } from 'vitest';

const MOCK_AIRPORTS = [
  {
    icao: 'KSFO',
    iata: 'SFO',
    name: 'San Francisco International',
    lat: 37.618,
    lon: -122.375,
    type: 'large_airport',
    runways: [],
  },
];

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_AIRPORTS,
    })
  );
  vi.resetModules();
});

describe('fetchAirports', () => {
  it('returns parsed airport data', async () => {
    const { fetchAirports } = await import('./airports');
    const result = await fetchAirports();
    expect(result).toHaveLength(1);
    expect(result[0].icao).toBe('KSFO');
    expect(result[0].type).toBe('large_airport');
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => [] })
    );
    const { fetchAirports } = await import('./airports');
    await expect(fetchAirports()).rejects.toThrow('404');
  });

  it('returns cached data on second call without re-fetching', async () => {
    const { fetchAirports } = await import('./airports');
    await fetchAirports();
    await fetchAirports();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});
