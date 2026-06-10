const MIN_GAP_MS = parseInt(process.env.ADS_REQUEST_GAP_MS ?? '1100');

class RateLimiter {
  private lastFired = 0;
  private queue: Array<() => void> = [];
  private running = false;

  schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(() => void fn().then(resolve, reject));
      if (!this.running) void this.drain();
    });
  }

  private async drain(): Promise<void> {
    this.running = true;
    while (this.queue.length > 0) {
      const gap = MIN_GAP_MS - (Date.now() - this.lastFired);
      if (gap > 0) await new Promise((r) => setTimeout(r, gap));
      this.lastFired = Date.now();
      this.queue.shift()!();
      // yield so the scheduled fn can start before we check timing again
      await new Promise((r) => setTimeout(r, 0));
    }
    this.running = false;
  }
}

export const rateLimiter = new RateLimiter();
