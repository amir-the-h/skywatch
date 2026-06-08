import { useEffect, useRef } from 'react';

const POLL_INTERVAL_MS = 60_000;

export function useVersionPoller(): void {
  const buildTimeRef = useRef<string | null>(null);

  useEffect(() => {
    async function fetchBuildTime(): Promise<string | null> {
      try {
        const res = await fetch('/version.json');
        if (!res.ok) return null;
        const data = await res.json();
        return typeof data.buildTime === 'string' ? data.buildTime : null;
      } catch {
        return null;
      }
    }

    fetchBuildTime().then((bt) => {
      buildTimeRef.current = bt;
    });

    const id = setInterval(async () => {
      const bt = await fetchBuildTime();
      if (bt !== null && buildTimeRef.current !== null && bt !== buildTimeRef.current) {
        window.location.reload();
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, []);
}
