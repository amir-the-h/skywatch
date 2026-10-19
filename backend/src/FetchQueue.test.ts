import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FetchQueue } from './FetchQueue';

describe('FetchQueue', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('calls fetchFn for added cell after one interval', async () => {
    const fetchFn = vi.fn().mockResolvedValue(undefined);
    const q = new FetchQueue(fetchFn, 1000);
    q.addCell('a:b');
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchFn).toHaveBeenCalledWith('a:b');
  });

  it('round-robins two cells over three ticks', async () => {
    const calls: string[] = [];
    const fetchFn = vi.fn(async (k: string) => { calls.push(k); });
    const q = new FetchQueue(fetchFn, 1000);
    q.addCell('cell1');
    q.addCell('cell2');
    await vi.advanceTimersByTimeAsync(3000);
    expect(calls).toEqual(['cell1', 'cell2', 'cell1']);
  });

  it('does not call fetchFn after cell is removed', async () => {
    const fetchFn = vi.fn().mockResolvedValue(undefined);
    const q = new FetchQueue(fetchFn, 1000);
    q.addCell('cell1');
    q.removeCell('cell1');
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('does not add duplicate cell keys', async () => {
    const fetchFn = vi.fn().mockResolvedValue(undefined);
    const q = new FetchQueue(fetchFn, 1000);
    q.addCell('cell1');
    q.addCell('cell1');
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('skips ticks while the previous poll is still running', async () => {
    const fetchFn = vi.fn(() => new Promise<void>((r) => setTimeout(r, 2500)));
    const q = new FetchQueue(fetchFn, 1000);
    q.addCell('cell1');
    await vi.advanceTimersByTimeAsync(3000);
    // tick@1000 starts a poll that runs until 3500; ticks @2000 and @3000 are skipped
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('keeps polling after fetchFn rejects', async () => {
    const fetchFn = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const q = new FetchQueue(fetchFn, 1000);
    q.addCell('cell1');
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
