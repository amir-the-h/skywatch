# Runway Ident Labels Design

**Date:** 2026-06-08
**Status:** Approved

## Overview

Show runway ident labels (e.g. "04", "22", "17R", "35L") at each end of every drawn runway on the radar canvas. Labels appear whenever the runway itself is drawn.

## Data

`airports.json` already contains `le.ident` and `he.ident` on every runway. The `RunwayEnd` type already has `ident: string`. No data or type changes needed.

Idents include plain numeric designators ("04", "22") and parallel-runway suffixes ("17L", "17R", "17C") — all handled uniformly.

## Rendering

**File:** `src/components/RadarView/RadarCanvas.ts`, `drawAirports()` function.

Inside the per-runway loop, after drawing the runway rectangle:

1. Compute the runway unit vector `(ux, uy)` from `le → he`: `ux = dx / lenPx`, `uy = dy / lenPx`
2. Place `le.ident` at `le` canvas position offset outward by 10px: `(le.x - ux×10, le.y - uy×10)`
3. Place `he.ident` at `he` canvas position offset outward by 10px: `(he.x + ux×10, he.y + uy×10)`
4. Skip if `lenPx < 8` — consistent with the existing runway rectangle guard

**Label style:**
- Font: `7px monospace`
- Color: `rgba(255,255,255,0.6)`
- `textAlign: 'center'`, `textBaseline: 'middle'`
- No rotation — horizontal text is easier to read at small sizes

## Scope

Single-function change inside the existing `drawAirports()` loop. No new files, no type changes, no data pipeline changes.
