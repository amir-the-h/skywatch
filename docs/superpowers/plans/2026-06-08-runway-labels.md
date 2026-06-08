# Runway Ident Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw runway ident labels ("04", "22", "17R", "35L", etc.) at each threshold end of every runway on the radar canvas.

**Architecture:** Single addition inside `drawAirports()` in `RadarCanvas.ts` — after drawing each runway rectangle, draw two text labels using the already-computed `le`/`he` canvas positions and unit vector. No new files, no type changes.

**Tech Stack:** TypeScript, HTML Canvas 2D API, Vitest

---

### Task 1: Add runway ident labels to `drawAirports()`

**Files:**
- Modify: `src/components/RadarView/RadarCanvas.ts` — `drawAirports()` function, inside the per-runway loop

> Note: `drawAirports()` has only canvas side-effects and is not unit-testable without heavy canvas mocking. Verification is visual (see step 3).

- [ ] **Step 1: Add the ident label drawing after the runway rectangle block**

In `src/components/RadarView/RadarCanvas.ts`, locate the per-runway loop inside `drawAirports()`. The relevant block ends with `ctx.restore()` after drawing the rectangle. Add the label drawing immediately after that `ctx.restore()`:

```typescript
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = `rgba(${base}, 0.12)`;
    ctx.strokeStyle = `rgba(${base}, 0.45)`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.rect(-lenPx / 2, -widthPx / 2, lenPx, widthPx);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Runway ident labels at each threshold end
    const ux = dx / lenPx;
    const uy = dy / lenPx;
    ctx.save();
    ctx.font = '7px monospace';
    ctx.fillStyle = `rgba(${base}, 0.6)`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(runway.le.ident, le.x - ux * 10, le.y - uy * 10);
    ctx.fillText(runway.he.ident, he.x + ux * 10, he.y + uy * 10);
    ctx.restore();
```

The variables `le`, `he`, `dx`, `dy`, `lenPx`, `ux`, `uy`, `base` are all already in scope at this point in the loop. The `lenPx < 8` guard earlier in the loop already skips short runways before reaching this code.

- [ ] **Step 2: Run the existing test suite to confirm nothing is broken**

```bash
cd /mnt/storage/shared/projects/personal/flight-tracker
npm test
```

Expected: all tests pass (the existing `RadarCanvas.test.ts` tests `computeLabelPositions`, not `drawAirports`, so they are unaffected).

- [ ] **Step 3: Visual verification**

Start the dev server:
```bash
npm run dev
```

Open the app in a browser. Zoom the radar so an airport with runways is visible (e.g. zoom in on a major airport). Confirm:
- Each runway end shows its ident (e.g. "04" at one threshold, "22" at the other)
- Parallel runways show suffixed idents (e.g. "17L", "35R")
- Labels are white/semi-transparent and do not obscure the runway rectangle
- Short runways that were already invisible remain invisible (lenPx < 8 guard)

- [ ] **Step 4: Commit**

```bash
git add src/components/RadarView/RadarCanvas.ts
git commit -m "feat: show runway ident labels at each threshold end"
```
