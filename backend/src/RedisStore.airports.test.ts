import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared mock client — all calls to createClient() return this same object
const mockClient = {
  on: vi.fn(),
  connect: vi.fn(),
  sMembers: vi.fn(),
  mGet: vi.fn(),
  sAdd: vi.fn(),
  set: vi.fn(),
  get: vi.fn(),
  hSet: vi.fn(),
  expire: vi.fn(),
  lPush: vi.fn(),
  lTrim: vi.fn(),
  lRange: vi.fn(),
  hGetAll: vi.fn(),
  del: vi.fn(),
  pipeline: vi.fn(() => ({
    set: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
};

// Mock the redis module before any imports that use it
vi.mock('redis', () => ({
  createClient: () => mockClient,
}));

import { RedisStore } from './RedisStore';
import type { Airport } from '../../shared/types';

const makeAirport = (icao: string, lat = 34.0, lon = -118.0): Airport => ({
  icao,
  iata: icao.slice(1),
  name: `${icao} Airport`,
  lat,
  lon,
  type: 'large_airport',
  runways: [],
});

describe('RedisStore — airport methods', () => {
  let store: RedisStore;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = mockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-stub pipeline after clearAllMocks resets it
    client.pipeline.mockReturnValue({
      set: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    });
    store = new RedisStore('redis://localhost:6379');
  });

  it('saveAllAirports pipelines a set call per airport', async () => {
    const airports = [makeAirport('KLAX'), makeAirport('KORD', 41.97, -87.9)];
    await store.saveAllAirports(airports);
    expect(client.pipeline).toHaveBeenCalled();
  });

  it('saveAirportIcaos calls sAdd with all icaos', async () => {
    client.sAdd.mockResolvedValue(2);
    await store.saveAirportIcaos(['KLAX', 'KORD']);
    expect(client.sAdd).toHaveBeenCalledWith('airports:icaos', ['KLAX', 'KORD']);
  });

  it('setAirportsHash sets the hash key with no TTL', async () => {
    client.set.mockResolvedValue('OK');
    await store.setAirportsHash('abc123');
    expect(client.set).toHaveBeenCalledWith('airports:hash', 'abc123');
  });

  it('getAirportsHash returns null when key missing', async () => {
    client.get.mockResolvedValue(null);
    const result = await store.getAirportsHash();
    expect(result).toBeNull();
  });

  it('getAirportsHash returns stored hash', async () => {
    client.get.mockResolvedValue('abc123');
    const result = await store.getAirportsHash();
    expect(result).toBe('abc123');
  });

  it('airportsInRadius returns airports within km', async () => {
    const klax = makeAirport('KLAX', 33.9425, -118.408);
    const kord = makeAirport('KORD', 41.9742, -87.9073);
    client.sMembers.mockResolvedValue(['KLAX', 'KORD']);
    client.mGet.mockResolvedValue([JSON.stringify(klax), JSON.stringify(kord)]);

    // 50km radius from KLAX — KORD is ~2800km away
    const result = await store.airportsInRadius(33.9425, -118.408, 50);
    expect(result).toHaveLength(1);
    expect(result[0].icao).toBe('KLAX');
  });

  it('airportsInRadius returns empty when icaos set is empty', async () => {
    client.sMembers.mockResolvedValue([]);
    const result = await store.airportsInRadius(34, -118, 100);
    expect(result).toHaveLength(0);
    expect(client.mGet).not.toHaveBeenCalled();
  });
});
