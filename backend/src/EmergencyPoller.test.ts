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

  it('aggregates aircraft from multiple sources and deduplicates', async () => {
    vi.resetModules();
    vi.stubEnv('ADS_SOURCES', 'https://src1.example.com/v2/point,https://src2.example.com/v2/point');

    const acSrc1 = { hex: 'AAA', lat: 40, lon: -75, flight: 'UA1', r: 'N1', squawk: '7700', gs: 400, track: 90, alt_baro: 35000, baro_rate: 0 };
    const acSrc2Only = { hex: 'BBB', lat: 41, lon: -76, flight: 'DA2', r: 'N2', squawk: '7700', gs: 350, track: 180, alt_baro: 30000, baro_rate: 0 };
    const acSrc2Dupe = { ...acSrc1 }; // same hex as acSrc1 — should be deduped

    // src1: 7500=[], 7600=[], 7700=[AAA]; src2: 7500=[], 7600=[], 7700=[BBB, AAA(dupe)]
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ac: [] }) } as Response)   // src1/7500
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ac: [] }) } as Response)   // src1/7600
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ac: [acSrc1] }) } as Response) // src1/7700
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ac: [] }) } as Response)   // src2/7500
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ac: [] }) } as Response)   // src2/7600
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ac: [acSrc2Only, acSrc2Dupe] }) } as Response); // src2/7700

    const { EmergencyPoller } = await import('./EmergencyPoller');
    const poller = new EmergencyPoller(mockStore as never, mockIo as never);
    await poller.pollNow();

    const saved: EmergencyAircraft[] = mockStore.saveEmergencySnapshot.mock.calls[0][0];
    expect(saved).toHaveLength(2);
    expect(saved.map((a) => a.hex)).toEqual(expect.arrayContaining(['AAA', 'BBB']));

    vi.unstubAllEnvs();
    vi.resetModules();
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
