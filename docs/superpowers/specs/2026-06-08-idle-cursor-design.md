# Idle Cursor Hide in Fullscreen

**Date:** 2026-06-08

## Summary

When the browser is in native fullscreen mode and the mouse has been idle for 5 seconds, hide the cursor. Restore it immediately on any mouse movement.

## Scope

- Cursor is hidden only while the browser is in native fullscreen (`document.fullscreenElement` is non-null).
- Outside fullscreen, cursor behavior is unchanged.
- Idle threshold: 5 seconds (hardcoded constant).

## Implementation

### New file: `src/hooks/useIdleCursor.ts`

A single React hook with no parameters and no return value.

**Lifecycle:**

1. On mount: attach `fullscreenchange` listener to `document`.
2. On `fullscreenchange`:
   - If entering fullscreen: attach `mousemove` listener to `document`, start 5-second idle timer.
   - If leaving fullscreen: clear timer, restore cursor, remove `mousemove` listener.
3. On `mousemove`: clear the current timer, restore cursor (`document.body.style.cursor = ''`), restart 5-second timer.
4. On idle timer fire: set `document.body.style.cursor = 'none'`.
5. On unmount: clear timer, restore cursor, remove all listeners.

**Constants:**

```ts
const IDLE_MS = 5000;
```

**Cursor state** is applied via `document.body.style.cursor` (inline style, no CSS additions, no store changes).

### Integration: `src/App.tsx`

Add one call alongside existing side-effect hooks:

```ts
useIdleCursor();
```

## What is NOT in scope

- Making the cursor reappear on keyboard input or scroll.
- Exposing the idle delay as a setting.
- Any CSS changes or new store state.
