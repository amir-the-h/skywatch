import { rateLimiter } from './RateLimiter';

const USER_AGENT = 'skywatch/1.0 (+https://github.com/amir-the-h/skywatch)';
const FETCH_TIMEOUT_MS = 5000;

export type UpstreamResult = { ok: true; data: unknown } | { ok: false; status: number };

// Rate-limited JSON GET against an ADS-B source. The timeout starts when the
// request leaves the RateLimiter queue, so time spent waiting for a slot
// doesn't count against it, and it covers reading the body too.
export function fetchUpstreamJson(url: string): Promise<UpstreamResult> {
  return rateLimiter.schedule(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!res.ok) return { ok: false, status: res.status };
      return { ok: true, data: await res.json() };
    } finally {
      clearTimeout(timer);
    }
  });
}
