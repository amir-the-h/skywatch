# Auto-Reload on New Deploy

## Goal

When a new Docker image is deployed, any open browser tabs detect it within 60 seconds and silently hard-reload themselves.

## Approach

Poll a `/version.json` file served as a static asset. The browser compares the `buildTime` it saw at startup to the value returned on each poll; a mismatch triggers `window.location.reload()`.

## Build artifact

The frontend Dockerfile gains a single line after `npm run build` to emit `dist/version.json`:

```dockerfile
RUN npm run build && \
    echo "{\"buildTime\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > dist/version.json
```

No nginx changes required — the existing static-file rule already serves everything under `/usr/share/nginx/html`.

## Frontend hook

`src/hooks/useVersionPoller.ts` — a side-effect-only hook, no return value.

**Behaviour:**
1. On mount: fetch `/version.json`, store `buildTime` in a ref.
2. Start a 60-second `setInterval` that re-fetches `/version.json`.
3. If `buildTime` differs from the stored ref, call `window.location.reload()`.
4. Fetch errors are silently ignored — the next tick retries automatically.
5. On unmount: clear the interval.

**Integration:** Called once at the top of `App.tsx`. No props, no store, no UI output.

## Out of scope

- User-visible toast or banner (silent reload chosen deliberately)
- Idle detection before reload
- Service worker involvement
