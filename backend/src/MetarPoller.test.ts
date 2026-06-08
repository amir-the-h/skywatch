import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MetarData } from '../../shared/types';

const mockStore = {
  saveMetar: vi.fn().mockResolvedValue(undefined),
  getManyMetar: vi.fn().mockResolvedValue({}),
};

const mockIo = {
  to: vi.fn().mockReturnThis(),
  emit: vi.fn(),
};

vi.stubGlobal('fetch', vi.fn());

describe('MetarPoller', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  it('addSocket registers socket icaos', async () => {
    const { MetarPoller } = await import('./MetarPoller');
    const poller = new MetarPoller(mockStore as never, mockIo as never);
    poller.addSocket('s1', ['KLAX', 'KORD']);
    expect(poller.allWantedIcaos()).toEqual(expect.arrayContaining(['KLAX', 'KORD']));
  });

  it('removeSocket clears socket icaos', async () => {
    const { MetarPoller } = await import('./MetarPoller');
    const poller = new MetarPoller(mockStore as never, mockIo as never);
    poller.addSocket('s1', ['KLAX']);
    poller.removeSocket('s1');
    expect(poller.allWantedIcaos()).toHaveLength(0);
  });

  it('allWantedIcaos returns union across all sockets', async () => {
    const { MetarPoller } = await import('./MetarPoller');
    const poller = new MetarPoller(mockStore as never, mockIo as never);
    poller.addSocket('s1', ['KLAX', 'KORD']);
    poller.addSocket('s2', ['KORD', 'KJFK']);
    const wanted = poller.allWantedIcaos();
    expect(new Set(wanted)).toEqual(new Set(['KLAX', 'KORD', 'KJFK']));
  });

  it('getMetarFor delegates to store.getManyMetar', async () => {
    const metar: MetarData = {
      windDir: 270, windSpeed: 12, windGust: null,
      raw: 'KLAX 081353Z 27012KT', observedAt: '2026-06-08T13:53:00Z',
    };
    mockStore.getManyMetar.mockResolvedValue({ KLAX: metar });

    const { MetarPoller } = await import('./MetarPoller');
    const poller = new MetarPoller(mockStore as never, mockIo as never);
    const result = await poller.getMetarFor(['KLAX']);
    expect(result).toEqual({ KLAX: metar });
    expect(mockStore.getManyMetar).toHaveBeenCalledWith(['KLAX']);
  });

  it('poll fetches METAR, stores in Redis, emits to each socket', async () => {
    const rawEntry = {
      icaoId: 'KLAX',
      rawOb: 'KLAX 081353Z 27012KT 10SM CLR 19/09 A2993',
      wdir: 270, wspd: 12, wgst: null,
      obsTime: '2026-06-08T13:53:00Z',
    };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [rawEntry],
    } as Response);

    mockStore.getManyMetar.mockResolvedValue({
      KLAX: { windDir: 270, windSpeed: 12, windGust: null, raw: rawEntry.rawOb, observedAt: rawEntry.obsTime },
    });

    const { MetarPoller } = await import('./MetarPoller');
    const poller = new MetarPoller(mockStore as never, mockIo as never);
    poller.addSocket('s1', ['KLAX']);

    await poller.pollNow();

    expect(mockStore.saveMetar).toHaveBeenCalledWith('KLAX', {
      windDir: 270,
      windSpeed: 12,
      windGust: null,
      raw: rawEntry.rawOb,
      observedAt: rawEntry.obsTime,
    });
    expect(mockIo.to).toHaveBeenCalledWith('s1');
    expect(mockIo.emit).toHaveBeenCalledWith('metar_update', { KLAX: expect.any(Object) });
  });

  it('poll does nothing when no sockets are registered', async () => {
    const { MetarPoller } = await import('./MetarPoller');
    const poller = new MetarPoller(mockStore as never, mockIo as never);
    await poller.pollNow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
