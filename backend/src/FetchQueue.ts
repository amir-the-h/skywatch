type FetchFn = (cellKey: string) => Promise<void>;

export class FetchQueue {
  private queue: string[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private fetchFn: FetchFn;
  private intervalMs: number;

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
    if (this.queue.length === 0) return;
    const key = this.queue.shift()!;
    this.queue.push(key);
    await this.fetchFn(key);
  }
}
