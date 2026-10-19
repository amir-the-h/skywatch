type FetchFn = (cellKey: string) => Promise<void>;

export class FetchQueue {
  private queue: string[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private fetchFn: FetchFn;
  private intervalMs: number;
  // A tick is skipped while the previous poll is still running, so a slow
  // upstream (or the shared RateLimiter) can't pile up unbounded work.
  private inFlight = false;

  constructor(fetchFn: FetchFn, intervalMs: number) {
    this.fetchFn = fetchFn;
    this.intervalMs = intervalMs;
  }

  addCell(key: string): void {
    if (this.queue.includes(key)) return;
    this.queue.push(key);
    if (!this.timer) this.start();
  }

  removeCell(key: string): void {
    this.queue = this.queue.filter((k) => k !== key);
    if (this.queue.length === 0) this.stop();
  }

  private start(): void {
    this.timer = setInterval(() => { void this.tick(); }, this.intervalMs);
  }

  private stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.queue.length === 0 || this.inFlight) return;
    const key = this.queue.shift()!;
    this.queue.push(key);
    this.inFlight = true;
    try {
      await this.fetchFn(key);
    } catch (err) {
      console.error(`[queue] poll failed for ${key}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.inFlight = false;
    }
  }
}
