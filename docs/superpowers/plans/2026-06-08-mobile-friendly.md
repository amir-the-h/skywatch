# Mobile-Friendly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the settings modal overflow on all screen sizes, add a native mobile bottom sheet on phones, add touch pan and pinch-to-zoom to the radar canvas, make canvas pin/unpin a toggle, and add a reset-view button.

**Architecture:** Pure CSS for the modal fixes; React touch event props added alongside existing mouse handlers on the canvas; one new `useState` for the reset button's visibility; no changes to the event model or store.

**Tech Stack:** React, Zustand (existing store), CSS custom properties + media queries, browser Touch Events API, existing `applyZoom` utility.

---

## File Map

| File | Change |
|---|---|
| `src/index.css` | Modal scroll fix, bottom-sheet media query, modal-handle, reset-btn position |
| `src/components/SettingsPanel/SettingsModal.tsx` | Add `<div className="modal-handle" />` |
| `src/components/RadarView/RadarView.tsx` | Pin toggle, isTransformed state, reset button, touch handlers |

---

### Task 1: Settings modal — global scroll fix + mobile bottom sheet

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/SettingsPanel/SettingsModal.tsx`

- [ ] **Step 1: Add max-height and overflow to the global `.modal` rule**

  In `src/index.css`, find the `.modal` block (currently ends with `backdrop-filter: blur(16px);`) and add two lines:

  ```css
  .modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 20px 24px;
    min-width: 340px;
    max-width: 480px;
    width: 100%;
    box-shadow: var(--shadow);
    backdrop-filter: blur(16px);
    max-height: calc(100dvh - 48px);
    overflow: hidden;
  }
  ```

- [ ] **Step 2: Add `overflow-y: auto` to `.modal-body`**

  Find the `.modal-body` block and add `overflow-y: auto`:

  ```css
  .modal-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow-y: auto;
  }
  ```

- [ ] **Step 3: Add modal-handle CSS, slideUp keyframe, and mobile media query**

  Append the following at the end of `src/index.css`:

  ```css
  /* ─── Modal handle (mobile bottom sheet) ─── */
  .modal-handle {
    display: none;
    width: 36px;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    margin: 0 auto 12px;
  }

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }

  @media (max-width: 640px) {
    .modal-handle { display: block; }

    .modal-backdrop { align-items: flex-end; }

    .modal {
      min-width: unset;
      width: 100%;
      max-width: 100%;
      border-radius: 16px 16px 0 0;
      max-height: 85dvh;
      padding-bottom: env(safe-area-inset-bottom, 16px);
      animation: slideUp 0.25s ease-out;
    }
  }
  ```

- [ ] **Step 4: Add `<div className="modal-handle" />` to the modal JSX**

  In `src/components/SettingsPanel/SettingsModal.tsx`, find:

  ```tsx
  <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
  ```

  Replace with:

  ```tsx
  <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-header">
  ```

- [ ] **Step 5: Verify build passes**

  ```bash
  cd /mnt/storage/shared/projects/personal/flight-tracker && npm run build 2>&1 | tail -5
  ```

  Expected: no errors, output ends with something like `✓ built in Xs`.

- [ ] **Step 6: Commit**

  ```bash
  git add src/index.css src/components/SettingsPanel/SettingsModal.tsx
  git commit -m "fix(ui): modal scroll fix and mobile bottom sheet"
  ```

---

### Task 2: Pin/unpin toggle on canvas click

**Files:**
- Modify: `src/components/RadarView/RadarView.tsx`

- [ ] **Step 1: Pull `unpin` from the store**

  In `src/components/RadarView/RadarView.tsx`, find:

  ```tsx
  const pin = useAircraftStore((s) => s.pin);
  ```

  Replace with:

  ```tsx
  const pin = useAircraftStore((s) => s.pin);
  const unpin = useAircraftStore((s) => s.unpin);
  ```

- [ ] **Step 2: Change `onMouseUp` to toggle pin/unpin**

  Find the `onMouseUp` handler on the canvas. The relevant block currently reads:

  ```tsx
  const hex = hitTest(e.clientX, e.clientY);
  if (hex) {
    if (pinTimeoutRef.current) clearTimeout(pinTimeoutRef.current);
    pinTimeoutRef.current = setTimeout(() => {
      pin(hex);
      pinTimeoutRef.current = null;
    }, 250);
  }
  ```

  Replace with:

  ```tsx
  const hex = hitTest(e.clientX, e.clientY);
  if (hex) {
    if (pinTimeoutRef.current) clearTimeout(pinTimeoutRef.current);
    pinTimeoutRef.current = setTimeout(() => {
      if (pinnedHexesRef.current.has(hex)) {
        unpin(hex);
      } else {
        pin(hex);
      }
      pinTimeoutRef.current = null;
    }, 250);
  }
  ```

- [ ] **Step 3: Run existing tests to make sure nothing broke**

  ```bash
  cd /mnt/storage/shared/projects/personal/flight-tracker && npm test -- --run 2>&1 | tail -10
  ```

  Expected: all tests pass.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/RadarView/RadarView.tsx
  git commit -m "fix(radar): toggle pin/unpin on canvas click"
  ```

---

### Task 3: Zoom/pan reset button

**Files:**
- Modify: `src/components/RadarView/RadarView.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add `isTransformed` state**

  In `RadarView.tsx`, find the line:

  ```tsx
  const [zoomScale, setZoomScale] = useState(1);
  ```

  Add a new state directly after it:

  ```tsx
  const [isTransformed, setIsTransformed] = useState(false);
  ```

- [ ] **Step 2: Mark `isTransformed` when the wheel zoom fires**

  Inside the `handleWheel` callback (in the `useEffect` that registers the wheel listener), find:

  ```tsx
      panOffsetRef.current = {
        x: (1 - f) * mx + f * panOffsetRef.current.x,
        y: (1 - f) * my + f * panOffsetRef.current.y,
      };
  ```

  Add one line after the closing brace of that assignment:

  ```tsx
      panOffsetRef.current = {
        x: (1 - f) * mx + f * panOffsetRef.current.x,
        y: (1 - f) * my + f * panOffsetRef.current.y,
      };
      setIsTransformed(true);
  ```

- [ ] **Step 3: Clear `isTransformed` in the double-click reset**

  Find the `onDoubleClick` handler:

  ```tsx
  onDoubleClick={() => {
    if (pinTimeoutRef.current) {
      clearTimeout(pinTimeoutRef.current);
      pinTimeoutRef.current = null;
    }
    zoomLevelRef.current = 1;
    panOffsetRef.current = { x: 0, y: 0 };
    setZoomScale(1);
  }}
  ```

  Replace with:

  ```tsx
  onDoubleClick={() => {
    if (pinTimeoutRef.current) {
      clearTimeout(pinTimeoutRef.current);
      pinTimeoutRef.current = null;
    }
    zoomLevelRef.current = 1;
    panOffsetRef.current = { x: 0, y: 0 };
    setZoomScale(1);
    setIsTransformed(false);
  }}
  ```

- [ ] **Step 4: Render the reset button inside the radar container**

  Find the closing `</div>` of the `bubbles-container` block (the last rendered element before the closing `</div>` of `radar-container`). The JSX structure currently ends with:

  ```tsx
      <div className="bubbles-container">
        {[...pinnedHexes].map((hex) => {
          ...
        })}
      </div>
    </div>
  ```

  Insert the button between `bubbles-container` and the closing `</div>`:

  ```tsx
      <div className="bubbles-container">
        {[...pinnedHexes].map((hex) => {
          const ac = aircraftMap.get(hex);
          if (!ac || !matchesFilter(ac, filters)) return null;
          const color = aircraftColor(ac.t, theme);
          return <FlightBubble key={hex} aircraft={ac} color={color} />;
        })}
      </div>

      {isTransformed && (
        <button
          className="icon-btn radar-reset-btn"
          onClick={() => {
            zoomLevelRef.current = 1;
            panOffsetRef.current = { x: 0, y: 0 };
            setZoomScale(1);
            setIsTransformed(false);
          }}
          title="Reset view"
        >
          ⌖
        </button>
      )}
    </div>
  ```

- [ ] **Step 5: Mark `isTransformed` when a mouse drag ends**

  In `RadarView.tsx`, find the drag-end path inside `onMouseUp`:

  ```tsx
  if (isDraggingRef.current) {
    isDraggingRef.current = false;
    e.currentTarget.style.cursor = 'default';
    return;
  }
  ```

  Replace with:

  ```tsx
  if (isDraggingRef.current) {
    isDraggingRef.current = false;
    e.currentTarget.style.cursor = 'default';
    setIsTransformed(
      panOffsetRef.current.x !== 0 ||
      panOffsetRef.current.y !== 0 ||
      zoomLevelRef.current !== 1,
    );
    return;
  }
  ```

- [ ] **Step 6: Add CSS for the reset button position**

  Append to `src/index.css`:

  ```css
  /* ─── Radar reset button ─── */
  .radar-reset-btn {
    position: absolute;
    bottom: 60px;
    right: 12px;
    z-index: 100;
  }
  ```

- [ ] **Step 7: Verify build passes**

  ```bash
  cd /mnt/storage/shared/projects/personal/flight-tracker && npm run build 2>&1 | tail -5
  ```

  Expected: no errors.

- [ ] **Step 8: Commit**

  ```bash
  git add src/components/RadarView/RadarView.tsx src/index.css
  git commit -m "feat(radar): add reset-view button when zoomed or panned"
  ```

---

### Task 4: Touch pan, pinch-to-zoom, and tap-to-toggle-pin

This task adds `onTouchStart`, `onTouchMove`, and `onTouchEnd` handlers to the radar canvas. Single-finger = pan; two-finger = pinch-to-zoom; tap (< 8px movement) = toggle pin/unpin.

**Files:**
- Modify: `src/components/RadarView/RadarView.tsx`

- [ ] **Step 1: Add touch refs**

  Find the block of existing refs near the top of `RadarView`:

  ```tsx
  const pinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  ```

  Add two new refs directly after it:

  ```tsx
  const pinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDistRef = useRef<number | null>(null);
  ```

- [ ] **Step 2: Add `touchAction: 'none'` to the canvas style**

  Find:

  ```tsx
  style={{ width: '100%', height: '100%', display: 'block', cursor: 'default' }}
  ```

  Replace with:

  ```tsx
  style={{ width: '100%', height: '100%', display: 'block', cursor: 'default', touchAction: 'none' }}
  ```

- [ ] **Step 3: Add touch event handlers to the canvas**

  Find the `onDoubleClick` handler (the last event prop on the canvas before the `/>` closing tag). Add the three touch handlers directly after `onDoubleClick`:

  ```tsx
        onTouchStart={(e) => {
          e.preventDefault();
          if (e.touches.length === 1) {
            const t = e.touches[0];
            isDraggingRef.current = true;
            dragStartRef.current = {
              x: t.clientX - panOffsetRef.current.x,
              y: t.clientY - panOffsetRef.current.y,
            };
            touchStartRef.current = { x: t.clientX, y: t.clientY };
          } else if (e.touches.length === 2) {
            isDraggingRef.current = false;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastPinchDistRef.current = Math.hypot(dx, dy);
          }
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          if (e.touches.length === 1 && isDraggingRef.current) {
            const t = e.touches[0];
            panOffsetRef.current = {
              x: t.clientX - dragStartRef.current.x,
              y: t.clientY - dragStartRef.current.y,
            };
            setIsTransformed(true);
          } else if (e.touches.length === 2 && lastPinchDistRef.current !== null) {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const newDist = Math.hypot(dx, dy);
            const delta = (lastPinchDistRef.current - newDist) * 2;
            lastPinchDistRef.current = newDist;
            const oldZoom = zoomLevelRef.current;
            zoomLevelRef.current = applyZoom(oldZoom, delta);
            setZoomScale(Math.sqrt(zoomLevelRef.current));
            const rect = canvas.getBoundingClientRect();
            const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left - canvas.width / 2;
            const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top - canvas.height / 2;
            const f = zoomLevelRef.current / oldZoom;
            panOffsetRef.current = {
              x: (1 - f) * mx + f * panOffsetRef.current.x,
              y: (1 - f) * my + f * panOffsetRef.current.y,
            };
            setIsTransformed(true);
          }
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          if (e.touches.length === 0) {
            // All fingers lifted — check for tap
            if (isDraggingRef.current && touchStartRef.current) {
              const t = e.changedTouches[0];
              const moved = Math.hypot(
                t.clientX - touchStartRef.current.x,
                t.clientY - touchStartRef.current.y,
              );
              if (moved < 8) {
                const hex = hitTest(t.clientX, t.clientY);
                if (hex) {
                  if (pinnedHexesRef.current.has(hex)) {
                    unpin(hex);
                  } else {
                    pin(hex);
                  }
                }
              }
            }
            isDraggingRef.current = false;
            touchStartRef.current = null;
            lastPinchDistRef.current = null;
          } else if (e.touches.length === 1) {
            // One finger lifted, one still down — avoid pan jump
            lastPinchDistRef.current = null;
            const remaining = e.touches[0];
            dragStartRef.current = {
              x: remaining.clientX - panOffsetRef.current.x,
              y: remaining.clientY - panOffsetRef.current.y,
            };
            touchStartRef.current = { x: remaining.clientX, y: remaining.clientY };
            isDraggingRef.current = true;
          }
        }}
  ```

- [ ] **Step 4: Run existing tests**

  ```bash
  cd /mnt/storage/shared/projects/personal/flight-tracker && npm test -- --run 2>&1 | tail -10
  ```

  Expected: all tests pass.

- [ ] **Step 5: Verify build passes**

  ```bash
  cd /mnt/storage/shared/projects/personal/flight-tracker && npm run build 2>&1 | tail -5
  ```

  Expected: no errors.

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/RadarView/RadarView.tsx
  git commit -m "feat(radar): touch pan, pinch-to-zoom, and tap-to-toggle-pin"
  ```
