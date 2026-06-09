import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockClient = {
  on: vi.fn(),
  connect: vi.fn(),
  hSet: vi.fn(),
  expire: vi.fn(),
  lPush: vi.fn(),
  lTrim: vi.fn(),
  lRange: vi.fn(),
  hGetAll: vi.fn(),
  del: vi.fn(),
  sAdd: vi.fn(),
  sMembers: vi.fn(),
  mGet: vi.fn(),
  set: vi.fn(),
  get: vi.fn(),
  multi: vi.fn(() => ({ set: vi.fn().mockReturnThis(), exec: vi.fn().mockResolvedValue([]) })),
};

vi.mock('redis', () => ({ createClient: () => mockClient }));

import { RedisStore } from './RedisStore';
import type { BackendAircraft } from '../../shared/types';

type NormalizedAircraft = Omit<BackendAircraft, 'pathHistory'>;

const makeAc = (overrides: Partial<NormalizedAircraft> = {}): NormalizedAircraft => ({
  hex: 'abc123',
  flight: 'TK123',
  r: 'TC-JMG',
  t: 'B738',
  lat: 34.0,
  lon: -118.0,
  alt_baro: 35000,
  gs: 450,
  track: 270,
  baro_rate: 0,
  seen: 1,
  phase: 'CRZ',
  ...overrides,
});

describe('RedisStore — saveAircraft sticky field serialization', () => {
  let store: RedisStore;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.hSet.mockResolvedValue(0);
    mockClient.lPush.mockResolvedValue(1);
    mockClient.lTrim.mockResolvedValue('OK');
    mockClient.expire.mockResolvedValue(1);
    store = new RedisStore('redis://localhost:6379');
  });

  it('includes non-empty flight, r, t in hSet payload', async () => {
    await store.saveAircraft(makeAc({ flight: 'TK123', r: 'TC-JMG', t: 'B738' }));
    const payload = mockClient.hSet.mock.calls[0][1] as Record<string, string>;
    expect(payload.flight).toBe('TK123');
    expect(payload.r).toBe('TC-JMG');
    expect(payload.t).toBe('B738');
  });

  it('omits flight from hSet payload when empty', async () => {
    await store.saveAircraft(makeAc({ flight: '' }));
    const payload = mockClient.hSet.mock.calls[0][1] as Record<string, string>;
    expect(payload).not.toHaveProperty('flight');
  });

  it('omits r from hSet payload when empty', async () => {
    await store.saveAircraft(makeAc({ r: '' }));
    const payload = mockClient.hSet.mock.calls[0][1] as Record<string, string>;
    expect(payload).not.toHaveProperty('r');
  });

  it('omits t from hSet payload when empty', async () => {
    await store.saveAircraft(makeAc({ t: '' }));
    const payload = mockClient.hSet.mock.calls[0][1] as Record<string, string>;
    expect(payload).not.toHaveProperty('t');
  });
});
