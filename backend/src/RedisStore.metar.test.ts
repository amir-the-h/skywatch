import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared mock client — all calls to createClient() return this same object
const mockClient = {
  on: vi.fn(),
  connect: vi.fn(),
  set: vi.fn(),
  get: vi.fn(),
  mGet: vi.fn(),
  sAdd: vi.fn(),
  sMembers: vi.fn(),
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
import type { MetarData } from '../../shared/types';

const makeMetar = (windDir: number | null = 270, windSpeed = 12): MetarData => ({
  windDir,
  windSpeed,
  windGust: null,
  raw: 'KLAX 081353Z 27012KT 10SM CLR 19/09 A2993',
  observedAt: '2026-06-08T13:53:00Z',
});

describe('RedisStore — METAR methods', () => {
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

  it('saveMetar stores JSON with 600s TTL', async () => {
    client.set.mockResolvedValue('OK');
    await store.saveMetar('KLAX', makeMetar());
    expect(client.set).toHaveBeenCalledWith(
      'metar:KLAX',
      JSON.stringify(makeMetar()),
      { EX: 600 }
    );
  });

  it('getManyMetar returns parsed MetarData for each found icao', async () => {
    const klaxMetar = makeMetar(270, 12);
    client.mGet.mockResolvedValue([JSON.stringify(klaxMetar), null]);
    const result = await store.getManyMetar(['KLAX', 'KORD']);
    expect(result).toEqual({ KLAX: klaxMetar });
    expect(result.KORD).toBeUndefined();
  });

  it('getManyMetar returns empty object when icaos array is empty', async () => {
    const result = await store.getManyMetar([]);
    expect(result).toEqual({});
    expect(client.mGet).not.toHaveBeenCalled();
  });
});
