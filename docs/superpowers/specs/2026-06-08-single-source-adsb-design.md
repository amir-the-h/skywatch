# Single-Source ADS-B Design

**Date:** 2026-06-08
**Status:** Approved

## Problem

The multi-source aggregator introduced in `1862309` merges data from two ADS-B providers on every poll. Even with the field-level merge fix, having two sources feeding positional data causes aircraft to jump between slightly different lat/lon readings reported by each provider, corrupting the path history trail in the UI.

## Decision

Use exactly one ADS-B provider at a time. The active provider is selected via an environment variable so it can be swapped without a code change.

## Changes

### `backend/src/CellPoller.ts`

- Remove `DEFAULT_SOURCES`, `SOURCES: string[]`, `sourceCounts`, `POS_FIELDS`, `META_FIELDS`, and the merge `Map`.
- Introduce `SOURCE: string` read from `process.env.ADS_SOURCE`, defaulting to `https://api.airplanes.live/v2/point`.
- Replace `Promise.allSettled(SOURCES.map(...))` with a single `fetch` call to `SOURCE`.
- Log line becomes: `[poll] cell <ck> | raw: <N> | sockets: <N>`.

### `backend/docker-compose.yml`

- Remove dead `AIRPLANES_LIVE_BASE` env var.
- Add `ADS_SOURCE: https://api.airplanes.live/v2/point` under the `backend` service environment.

## Unchanged

- `RedisStore.ts` — no change
- `server.ts` — no change
- `shared/types.ts` — no change
- Frontend — no change

## Configuration

To switch providers, set `ADS_SOURCE` to any ADS-B V2-compatible base URL:

```
ADS_SOURCE=https://api.adsb.lol/v2/point
```
