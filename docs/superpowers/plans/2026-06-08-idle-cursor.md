# Idle Cursor Hide in Fullscreen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the mouse cursor after 5 seconds of idle when the browser is in native fullscreen mode, and restore it immediately on any mouse movement.

**Architecture:** A single `useIdleCursor` hook manages all logic — it listens for `fullscreenchange` events, tracks mouse idle time with a `setTimeout`, and toggles `document.body.style.cursor` between `'none'` and `''`. No store changes, no CSS additions. Registered once in `App.tsx`.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library (existing test infra)

---

### Task 1: Implement `useIdleCursor` hook (TDD)

**Files:**
- Create: `src/hooks/useIdleCursor.test.ts`
- Create: `src/hooks/useIdleCursor.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/useIdleCursor.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIdleCursor } from './useIdleCursor';

describe('useIdleCursor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset cursor and fullscreen state
    document.body.style.cursor = '';
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function enterFullscreen() {
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => document.body,
    });
    document.dispatchEvent(new Event('fullscreenchange'));
  }

  function exitFullscreen() {
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => null,
    });
    document.dispatchEvent(new Event('fullscreenchange'));
  }

  it('does not hide cursor outside fullscreen after 5s idle', () => {
    renderHook(() => useIdleCursor());
    act(() => { vi.advanceTimersByTime(6000); });
    expect(document.body.style.cursor).toBe('');
  });

  it('hides cursor after 5s idle in fullscreen', () => {
    renderHook(() => useIdleCursor());
    act(() => { enterFullscreen(); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(document.body.style.cursor).toBe('none');
  });

  it('does not hide cursor before 5s elapses in fullscreen', () => {
    renderHook(() => useIdleCursor());
    act(() => { enterFullscreen(); });
    act(() => { vi.advanceTimersByTime(4999); });
    expect(document.body.style.cursor).toBe('');
  });

  it('restores cursor on mouse move after it was hidden', () => {
    renderHook(() => useIdleCursor());
    act(() => { enterFullscreen(); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(document.body.style.cursor).toBe('none');
    act(() => { document.dispatchEvent(new MouseEvent('mousemove')); });
    expect(document.body.style.cursor).toBe('');
  });

  it('resets idle timer on mouse move so cursor stays visible for another 5s', () => {
    renderHook(() => useIdleCursor());
    act(() => { enterFullscreen(); });
    act(() => { vi.advanceTimersByTime(4000); });
    act(() => { document.dispatchEvent(new MouseEvent('mousemove')); });
    act(() => { vi.advanceTimersByTime(4999); });
    expect(document.body.style.cursor).toBe('');
    act(() => { vi.advanceTimersByTime(1); });
    expect(document.body.style.cursor).toBe('none');
  });

  it('restores cursor and clears timer when leaving fullscreen', () => {
    renderHook(() => useIdleCursor());
    act(() => { enterFullscreen(); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(document.body.style.cursor).toBe('none');
    act(() => { exitFullscreen(); });
    expect(document.body.style.cursor).toBe('');
    // No further timer fires
    act(() => { vi.advanceTimersByTime(5000); });
    expect(document.body.style.cursor).toBe('');
  });

  it('restores cursor on unmount', () => {
    const { unmount } = renderHook(() => useIdleCursor());
    act(() => { enterFullscreen(); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(document.body.style.cursor).toBe('none');
    act(() => { unmount(); });
    expect(document.body.style.cursor).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- useIdleCursor
```

Expected: all tests FAIL with "Cannot find module './useIdleCursor'"

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useIdleCursor.ts`:

```ts
import { useEffect } from 'react';

const IDLE_MS = 5000;

export function useIdleCursor(): void {
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null;

    function showCursor() {
      document.body.style.cursor = '';
    }

    function hideCursor() {
      document.body.style.cursor = 'none';
    }

    function resetTimer() {
      if (timerId !== null) clearTimeout(timerId);
      showCursor();
      timerId = setTimeout(hideCursor, IDLE_MS);
    }

    function clearTimer() {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    }

    function onFullscreenChange() {
      if (document.fullscreenElement) {
        document.addEventListener('mousemove', resetTimer);
        resetTimer();
      } else {
        document.removeEventListener('mousemove', resetTimer);
        clearTimer();
        showCursor();
      }
    }

    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('mousemove', resetTimer);
      clearTimer();
      showCursor();
    };
  }, []);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- useIdleCursor
```

Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useIdleCursor.ts src/hooks/useIdleCursor.test.ts
git commit -m "feat: add useIdleCursor hook — hides cursor after 5s idle in fullscreen"
```

---

### Task 2: Register hook in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import and call the hook**

In `src/App.tsx`, add the import alongside the other hook imports:

```ts
import { useIdleCursor } from './hooks/useIdleCursor';
```

Then inside the `App` function body, add the call next to `useAircraftSocket()` and `useVersionPoller()`:

```ts
useIdleCursor();
```

The relevant section of `App.tsx` will look like:

```ts
useAircraftSocket();
useVersionPoller();
useIdleCursor();
```

- [ ] **Step 2: Run full test suite to confirm nothing broke**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: register useIdleCursor in App — hide cursor on idle in fullscreen"
```
