# Auto-Reload on New Deploy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The browser silently hard-reloads itself within 60 seconds of a new Docker deploy being served.

**Architecture:** The Dockerfile emits `dist/version.json` (containing a UTC build timestamp) after `npm run build`. The frontend polls `/version.json` every 60 seconds via a `useVersionPoller` hook; if the timestamp differs from the one captured at startup, it calls `window.location.reload()`. The hook is registered once in `App.tsx` with no UI output.

**Tech Stack:** Vite + React 19, TypeScript, nginx (static file serving), Docker multi-stage build.

---

### Task 1: Emit `version.json` from the Dockerfile

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Read the current Dockerfile**

```
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_BACKEND_URL=http://localhost:3001
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 2: Append the version file generation to the build RUN command**

Replace the build-stage `RUN npm run build` line with:

```dockerfile
RUN npm run build && \
    echo "{\"buildTime\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > dist/version.json
```

The full updated `Dockerfile` should look like:

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_BACKEND_URL=http://localhost:3001
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
RUN npm run build && \
    echo "{\"buildTime\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > dist/version.json

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 3: Verify the file is created in a local build (optional smoke test)**

```bash
docker build -t flight-tracker-test .
docker run --rm flight-tracker-test cat /usr/share/nginx/html/version.json
```

Expected output: something like `{"buildTime":"2026-06-08T12:00:00Z"}`

- [ ] **Step 4: Commit**

```bash
git add Dockerfile
git commit -m "build: emit version.json with build timestamp in Docker image"
```

---

### Task 2: Write the `useVersionPoller` hook (TDD)

**Files:**
- Create: `src/hooks/useVersionPoller.test.ts`
- Create: `src/hooks/useVersionPoller.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/useVersionPoller.test.ts`:

```typescript
import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useVersionPoller } from './useVersionPoller';

describe('useVersionPoller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window.location, 'reload').mockImplementation(() => {});
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
    await vi.runAllTicsAsync();

    expect(fetchSpy).toHaveBeenCalledWith('/version.json');
  });

  it('does not reload when buildTime is unchanged', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ buildTime: '2026-01-01T00:00:00Z' }),
    } as Response);

    renderHook(() => useVersionPoller());
    await vi.runAllTicsAsync();

    vi.advanceTimersByTime(60_000);
    await vi.runAllTicsAsync();

    expect(window.location.reload).not.toHaveBeenCalled();
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
    await vi.runAllTicsAsync();

    vi.advanceTimersByTime(60_000);
    await vi.runAllTicsAsync();

    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it('silently ignores fetch errors', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return { ok: true, json: async () => ({ buildTime: '2026-01-01T00:00:00Z' }) } as Response;
      throw new Error('network error');
    });

    renderHook(() => useVersionPoller());
    await vi.runAllTicsAsync();

    vi.advanceTimersByTime(60_000);
    await vi.runAllTicsAsync();

    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it('clears the interval on unmount', async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ buildTime: '2026-01-01T00:00:00Z' }),
    } as Response);

    const { unmount } = renderHook(() => useVersionPoller());
    await vi.runAllTicsAsync();
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- useVersionPoller
```

Expected: FAIL — `useVersionPoller` module not found.

- [ ] **Step 3: Implement `useVersionPoller`**

Create `src/hooks/useVersionPoller.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- useVersionPoller
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useVersionPoller.ts src/hooks/useVersionPoller.test.ts
git commit -m "feat: add useVersionPoller hook — polls /version.json, reloads on new deploy"
```

---

### Task 3: Wire `useVersionPoller` into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import and call the hook in `App`**

In `src/App.tsx`, add the import alongside the other hook imports:

```typescript
import { useVersionPoller } from './hooks/useVersionPoller';
```

Inside the `App` function body, add the call directly after `useAircraftSocket()`:

```typescript
useAircraftSocket();
useVersionPoller();
```

- [ ] **Step 2: Run the full test suite to confirm nothing regressed**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: register useVersionPoller in App — auto-reload on deploy"
```
