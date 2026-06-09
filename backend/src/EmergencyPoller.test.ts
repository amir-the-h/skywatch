import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EmergencyAircraft } from '../../shared/types';

const mockStore = {
  saveEmergencySnapshot: vi.fn().mockResolvedValue(undefined),
  getEmergencySnapshot: vi.fn().mockResolvedValue([]),
};

const mockIo = { emit: vi.fn() };

vi.stubGlobal('fetch', vi.fn());

describe('EmergencyPoller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deduplicates aircraft that appear in multiple squawk results', async () => {
    const ac7700 = { hex: 'ABC123', lat: 40, lon: -75, flight: 'UAL1', r: 'N123AB', squawk: '7700', gs: 400, track: 90, alt_baro: 35000, baro_rate: 0 };
    const ac7500 = { hex: 'DEF456', lat: 41, lon: -76, flight: 'DAL2', r: 'N456CD', squawk: '7500', gs: 350, track: 180, alt_baro: 30000, baro_rate: 0 };
    const acDupe = { ...ac7700 };

    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ac: [ac7700] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ac: [ac7500] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ac: [acDupe] }) } as Response);

    const { EmergencyPoller } = await import('./EmergencyPoller');
    const poller = new EmergencyPoller(mockStore as never, mockIo as never);
    await poller.pollNow();

    const saved: EmergencyAircraft[] = mockStore.saveEmergencySnapshot.mock.calls[0][0];
    expect(saved).toHaveLength(2);
    expect(saved.map((a) => a.hex)).toEqual(expect.arrayContaining(['ABC123', 'DEF456']));
    expect(mockIo.emit).toHaveBeenCalledWith('emergency_update', saved);
  });

  it('handles a fetch error on one endpoint without throwing', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ac: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ac: [] }) } as Response);

    const { EmergencyPoller } = await import('./EmergencyPoller');
    const poller = new EmergencyPoller(mockStore as never, mockIo as never);
    await expect(poller.pollNow()).resolves.not.toThrow();
    expect(mockStore.saveEmergencySnapshot).toHaveBeenCalledWith([]);
  });

  it('getSnapshot delegates to store.getEmergencySnapshot', async () => {
    const snap: EmergencyAircraft[] = [{ hex: 'X', flight: 'T1', r: 'N1', lat: 0, lon: 0, alt_baro: 0, gs: 0, track: 0 }];
    mockStore.getEmergencySnapshot.mockResolvedValueOnce(snap);

    const { EmergencyPoller } = await import('./EmergencyPoller');
    const poller = new EmergencyPoller(mockStore as never, mockIo as never);
    expect(await poller.getSnapshot()).toBe(snap);
  });

  it('filters out aircraft with missing lat/lon', async () => {
    const badAc = { hex: 'BAD', flight: 'X', r: 'N', squawk: '7700' }; // no lat/lon
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ac: [badAc] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ac: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ac: [] }) } as Response);

    const { EmergencyPoller } = await import('./EmergencyPoller');
    const poller = new EmergencyPoller(mockStore as never, mockIo as never);
    await poller.pollNow();

    const saved: EmergencyAircraft[] = mockStore.saveEmergencySnapshot.mock.calls[0][0];
    expect(saved).toHaveLength(0);
  });
});
