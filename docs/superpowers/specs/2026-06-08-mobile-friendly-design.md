# Mobile-Friendly Design Spec

**Date:** 2026-06-08
**Status:** Approved

## Problem

Three issues make the app unusable on mobile (and partially on small desktops):

1. The settings modal has no max-height and no scroll — content overflows off the bottom of the viewport on any screen smaller than the modal's natural height.
2. The radar canvas only handles mouse events — no touch pan, no pinch-to-zoom.
3. Clicking a pinned aircraft on the canvas does nothing (pin is add-only, not a toggle).

A fourth UX gap: on mobile there is no way to reset zoom/pan since the desktop double-click gesture doesn't exist.

## Approach

Targeted fixes alongside existing code — touch handlers added next to mouse handlers, CSS media query layered on top of a global scroll fix. No refactor of the event model.

---

## Section 1 — Settings Modal: Scroll Fix + Mobile Bottom Sheet

### Global fix (all screen sizes)

- `.modal`: add `max-height: calc(100dvh - 48px)` so the modal is never taller than the viewport.
- `.modal-body`: add `overflow-y: auto` so content scrolls within the modal when it exceeds that height.

This fixes the MacBook small-window case and any future screen size.

### Mobile-only (≤ 640px)

A `@media (max-width: 640px)` block transforms the modal into a bottom sheet:

- `.modal-backdrop`: `align-items: flex-end` — anchors the modal to the bottom of the screen.
- `.modal`: full width (`width: 100%; max-width: 100%`), square bottom corners, rounded top corners (`border-radius: 16px 16px 0 0`), `max-height: 85dvh`, `padding-bottom: env(safe-area-inset-bottom, 16px)` for notched phones.
- `.modal-body`: inherits `overflow-y: auto` from global fix; height constrained within the sheet.
- Drag-handle pill at top of sheet: a small `<div>` with class `modal-handle` rendered as the first child of `.modal` (cosmetic only).
- Slide-up entrance animation: `@keyframes slideUp` using `transform: translateY(100%) → translateY(0)`, duration 0.25s ease-out.

Desktop appearance is completely unchanged.

**Files:** `src/index.css`

---

## Section 2 — Radar Canvas: Touch Pan & Pinch-to-Zoom

Touch handlers added to the `<canvas>` element as React event props alongside the existing mouse handlers.

### CSS

Add `touch-action: none` inline on the canvas (or via CSS class) so the browser hands all touch events to JS without triggering native scroll or zoom.

### `onTouchStart`

- 1 finger: begin pan — record touch position as drag start (mirrors `onMouseDown` on empty canvas space). Sets `isDraggingRef.current = true`.
- 2 fingers: record initial distance between touch points in `lastPinchDistRef` for pinch tracking.
- Always calls `e.preventDefault()`.

### `onTouchMove`

- 1 finger: update `panOffsetRef` from current touch position (mirrors drag `onMouseMove`).
- 2 fingers: compute new distance between touch points; call `applyZoom` with the delta; shift `panOffsetRef` so the midpoint between fingers stays fixed (same anchor logic as the wheel handler). Update `setZoomScale` and `isTransformed`.
- Always calls `e.preventDefault()`.

### `onTouchEnd`

- If finger moved < 8px from start: treat as tap — hit-test the canvas and toggle pin (see Section 3).
- Otherwise: end drag, clean up refs.
- If transitioning from 2-finger to 1-finger (one finger lifts): reset drag start to the remaining finger's position to avoid a pan jump.

**Files:** `src/components/RadarView/RadarView.tsx`

---

## Section 3 — Pin/Unpin Toggle on Canvas Tap/Click

Currently `pin(hex)` only adds to the pinned set. Clicking a pinned aircraft does nothing visible on the canvas (the bubble's ✕ is the only way to unpin).

### Change

- Pull `unpin` from `useAircraftStore` alongside the existing `pin`.
- In `onMouseUp` (desktop click) and `onTouchEnd` tap path (mobile): check `pinnedHexesRef.current.has(hex)`.
  - If already pinned: call `unpin(hex)`.
  - Otherwise: call `pin(hex)`.
- The 250ms debounce protecting against double-click zoom reset is kept as-is on desktop.
- The ✕ button on `FlightBubble` continues to call `unpin` directly — no change there.

**Files:** `src/components/RadarView/RadarView.tsx`

---

## Section 4 — Zoom/Pan Reset Button

### State

Add `const [isTransformed, setIsTransformed] = useState(false)` to `RadarView`.

Set `isTransformed(true)` any time zoom or pan changes:
- Wheel zoom handler
- Mouse drag end (`onMouseUp`)
- Touch pan end (`onTouchEnd`)
- Pinch zoom (`onTouchMove` 2-finger path)

Set `isTransformed(false)` when reset is triggered.

### Button

Rendered inside `.radar-container` as an absolutely-positioned overlay:

- Visible only when `isTransformed === true`.
- Positioned bottom-right, above the filter drawer (e.g., `bottom: 60px; right: 12px`).
- Icon: `⌖` (or similar reset symbol).
- On click: `zoomLevelRef.current = 1`, `panOffsetRef.current = { x: 0, y: 0 }`, `setZoomScale(1)`, `setIsTransformed(false)`.
- Styled as `.icon-btn` (matches existing HUD buttons).

The existing desktop double-click reset (`onDoubleClick`) remains in place and also calls `setIsTransformed(false)` to hide the reset button.

**Files:** `src/components/RadarView/RadarView.tsx`, `src/index.css` (positioning rule for the reset button if not handled inline)

---

## Out of Scope

- MapView (Leaflet) already handles touch pan/zoom natively — no changes needed.
- Filter drawer — already a horizontal bar at the bottom, works acceptably on mobile.
- HUD button sizes — not reported as a problem, out of scope.
