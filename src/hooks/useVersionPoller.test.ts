import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useVersionPoller } from './useVersionPoller';

// Drain the microtask queue (multiple levels of async/await)
const flushMicrotasks = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('useVersionPoller', () => {
  const reloadMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadMock },
    });
    reloadMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('fetches version.json on mount', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ buildTime: '2026-01-01T00:00:00Z' }),
    } as Response);

    renderHook(() => useVersionPoller());
    await flushMicrotasks();

    expect(fetchSpy).toHaveBeenCalledWith('/version.json');
  });

  it('does not reload when buildTime is unchanged', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ buildTime: '2026-01-01T00:00:00Z' }),
    } as Response);

    renderHook(() => useVersionPoller());
    await flushMicrotasks();

    await vi.advanceTimersByTimeAsync(60_000);
    await flushMicrotasks();

    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('reloads when buildTime changes', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        json: async () => ({
          buildTime: callCount === 1 ? '2026-01-01T00:00:00Z' : '2026-01-02T00:00:00Z',
        }),
      } as Response;
    });

    renderHook(() => useVersionPoller());
    await flushMicrotasks();

    await vi.advanceTimersByTimeAsync(60_000);
    await flushMicrotasks();

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('silently ignores fetch errors', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return { ok: true, json: async () => ({ buildTime: '2026-01-01T00:00:00Z' }) } as Response;
      throw new Error('network error');
    });

    renderHook(() => useVersionPoller());
    await flushMicrotasks();

    await vi.advanceTimersByTimeAsync(60_000);
    await flushMicrotasks();

    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('clears the interval on unmount', async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ buildTime: '2026-01-01T00:00:00Z' }),
    } as Response);

    const { unmount } = renderHook(() => useVersionPoller());
    await flushMicrotasks();
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
