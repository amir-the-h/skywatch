# Radar Label Placement — Design Spec

**Date:** 2026-06-08
**Status:** Approved

## Problem

When two or more aircraft are close together on the radar canvas, their label bubbles render on top of each other. The existing placement logic only avoids canvas edges (four static fallback positions); it has no awareness of other labels.

## Goals

- Labels never hard-overlap when avoidable
- Label positions update smoothly every frame (no snapping)
- When overlap is unavoidable (extreme cluster), lower-priority labels fade rather than disappear
- Connector lines remain correct at all times

## Approach: Hybrid (Slot Selection + Force Nudge + Lerp)

Two-phase placement per frame, animated via lerp.

### Phase 1 — Slot Selection (greedy, priority-ordered)

Labels are placed in priority order so higher-priority aircraft claim the best slots first:

1. Pinned aircraft
2. Emergency squawks (7500 / 7600 / 7700 or emergency flag)
3. Airport-phase aircraft (TXI, GND, T/O, APP)
4. All others (alphabetical by callsign for tie-breaking stability)

For each label, 16 candidate positions are evaluated: 8 evenly-spaced angles (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°) × 2 radii (44px and 80px from the aircraft center).

Label box origin for a given slot:
```
lx = aircraft.x + cos(angle) * radius - LABEL_W / 2
ly = aircraft.y + sin(angle) * radius - LABEL_H / 2
```

Connector line attaches from aircraft center to the nearest edge of the label box (not its center), matching current behaviour.

**Scoring** — lower is better:
- `+overlap_area` (px²) with each already-committed label
- `+canvas_edge_clip` — pixels the label would extend outside canvas bounds
- `+angle_preference_penalty` — small cost (200) for angles far from 315° (upper-right), so ties break toward the current default

The slot with the lowest score is committed. If all 16 slots overlap, the best slot is still committed — no label is suppressed; the fallback is opacity reduction.

### Phase 2 — Force Nudge

One O(n²) pass over all committed label pairs:

```
for each pair (a, b):
  overlap = intersectionRect(a, b)
  if overlap exists:
    push each label away by half the overlap distance
    clamp both to canvas bounds
```

One pass is sufficient for the expected density (2–50 labels).

### Opacity

Computed after the force pass:

```
overlapRatio = totalOverlapArea(label, allOtherLabels) / (LABEL_W * LABEL_H)
opacity = lerp(1.0, 0.45, clamp(overlapRatio * 3, 0, 1))
```

Connector line opacity = label opacity × 0.6 (preserving current behaviour).

### Animation (Lerp)

`labelPosRef` (a `Map<hex, {x, y}>`) holds the current rendered position across frames. Each frame:

```
current.x += (target.x - current.x) * LABEL_LERP   // 0.12
current.y += (target.y - current.y) * LABEL_LERP
```

- `LABEL_LERP = 0.12` — settles in ~300ms at 60fps, exposed as a named constant
- New aircraft initialise directly at target (no slide-in from off-screen)
- Removed aircraft are deleted from the ref

## Edge Cases

| Situation | Handling |
|-----------|----------|
| Zoom or pan jumps sharply | If pan/zoom delta exceeds threshold in one frame, reset `labelPosRef` to target positions directly (skip lerp that frame) |
| Canvas resize | Same as zoom/pan jump — reset positions |
| Single aircraft on screen | Fast-path: skip scoring, use slot 0 (315°, 44px) directly |
| Aircraft at canvas edge | `canvas_edge_clip` penalty in scoring naturally prefers inward angles |

## Files Changed

| File | Change |
|------|--------|
| `src/components/RadarView/RadarCanvas.ts` | Add `computeLabelPositions()`, `labelPosRef` map; update `drawAircraftLabels()` to consume the map |
| `src/components/RadarView/RadarView.tsx` | Pass `labelPosRef` into render call, or keep as module-level ref if canvas instance is stable |

## Out of Scope

- Label clustering / column stacking
- Changes to `shouldShowLabel()` or label visibility conditions
- Hit-testing label boxes (clicking a label to pin)
- New files or CSS changes

## Constants

| Name | Value | Description |
|------|-------|-------------|
| `LABEL_W` | 100px | Label box width (existing) |
| `LABEL_H` | 52px | Label box height (existing) |
| `LABEL_OFFSET_NEAR` | 44px | Near-radius slot distance |
| `LABEL_OFFSET_FAR` | 80px | Far-radius slot distance |
| `LABEL_LERP` | 0.12 | Lerp factor per frame |
| `LABEL_MIN_OPACITY` | 0.45 | Minimum opacity under full overlap |
| `LABEL_ANGLE_PENALTY` | 200 | Score penalty per radian from preferred angle |
| `LABEL_RESET_THRESHOLD` | 40px | Pan/zoom delta above which lerp is skipped for that frame |
