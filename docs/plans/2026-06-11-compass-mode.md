# Compass Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Use compass" toggle that drives `headingDeg` from the device orientation API, hiding the manual heading input while active.

**Architecture:** A new non-persisted Zustand store (`useCompassStore`) owns the `DeviceOrientationEvent` listener lifecycle and pipes compass readings into the existing `useSettingsStore.headingDeg`. `SettingsModal` reads from both stores and conditionally renders the compass UI vs. the manual input.

**Tech Stack:** React 19, Zustand, Vitest + jsdom, `@testing-library/react`, `DeviceOrientationEvent` / `deviceorientationabsolute` browser API.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/hooks/useCompass.ts` | Zustand store: enable/disable compass listener, iOS permission |
| Create | `src/hooks/useCompass.test.ts` | Unit tests for store logic |
| Modify | `src/components/SettingsPanel/SettingsModal.tsx` | Conditional compass/manual heading UI |
| Create | `src/components/SettingsPanel/SettingsModal.test.tsx` | Render tests for compass UI states |
| Modify | `src/index.css` | `.compass-status` style |

---

### Task 1: `useCompass` store

**Files:**
- Create: `src/hooks/useCompass.ts`
- Create: `src/hooks/useCompass.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/useCompass.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useCompassStore } from './useCompass';
import { useSettingsStore } from './useSettings';
import { DEFAULT_SETTINGS } from '../types/aircraft';

// jsdom may or may not define DeviceOrientationEvent — control it explicitly
let _origDOE: unknown;

beforeEach(() => {
  _origDOE = (window as unknown as Record<string, unknown>).DeviceOrientationEvent;
  act(() => { useCompassStore.getState().disable(); }); // flush any leftover listener
  useCompassStore.setState({ isActive: false, error: null });
  useSettingsStore.setState(DEFAULT_SETTINGS);
});

afterEach(() => {
  act(() => { useCompassStore.getState().disable(); });
  (window as unknown as Record<string, unknown>).DeviceOrientationEvent = _origDOE;
});

describe('useCompass', () => {
  it('sets error unsupported when DeviceOrientationEvent is undefined', async () => {
    (window as unknown as Record<string, unknown>).DeviceOrientationEvent = undefined;
    await act(async () => { await useCompassStore.getState().enable(); });
    expect(useCompassStore.getState().error).toBe('unsupported');
    expect(useCompassStore.getState().isActive).toBe(false);
  });

  it('sets isActive true when DeviceOrientationEvent exists without requestPermission', async () => {
    (window as unknown as Record<string, unknown>).DeviceOrientationEvent = class {};
    await act(async () => { await useCompassStore.getState().enable(); });
    expect(useCompassStore.getState().isActive).toBe(true);
    expect(useCompassStore.getState().error).toBeNull();
  });

  it('sets error denied when iOS requestPermission returns denied', async () => {
    (window as unknown as Record<string, unknown>).DeviceOrientationEvent = class {
      static requestPermission = vi.fn().mockResolvedValue('denied');
    };
    await act(async () => { await useCompassStore.getState().enable(); });
    expect(useCompassStore.getState().error).toBe('denied');
    expect(useCompassStore.getState().isActive).toBe(false);
  });

  it('sets isActive true when iOS requestPermission returns granted', async () => {
    (window as unknown as Record<string, unknown>).DeviceOrientationEvent = class {
      static requestPermission = vi.fn().mockResolvedValue('granted');
    };
    await act(async () => { await useCompassStore.getState().enable(); });
    expect(useCompassStore.getState().isActive).toBe(true);
  });

  it('updates headingDeg when orientation event fires with alpha', async () => {
    (window as unknown as Record<string, unknown>).DeviceOrientationEvent = class {};
    await act(async () => { await useCompassStore.getState().enable(); });

    const event = new Event('deviceorientation') as DeviceOrientationEvent;
    Object.defineProperty(event, 'alpha', { value: 135, configurable: true });
    act(() => { window.dispatchEvent(event); });

    expect(useSettingsStore.getState().headingDeg).toBe(135);
  });

  it('does not update headingDeg when alpha is null', async () => {
    (window as unknown as Record<string, unknown>).DeviceOrientationEvent = class {};
    await act(async () => { await useCompassStore.getState().enable(); });

    const event = new Event('deviceorientation') as DeviceOrientationEvent;
    Object.defineProperty(event, 'alpha', { value: null, configurable: true });
    const before = useSettingsStore.getState().headingDeg;
    act(() => { window.dispatchEvent(event); });

    expect(useSettingsStore.getState().headingDeg).toBe(before);
  });

  it('sets isActive false on disable', async () => {
    (window as unknown as Record<string, unknown>).DeviceOrientationEvent = class {};
    await act(async () => { await useCompassStore.getState().enable(); });
    act(() => { useCompassStore.getState().disable(); });
    expect(useCompassStore.getState().isActive).toBe(false);
  });

  it('stops updating headingDeg after disable', async () => {
    (window as unknown as Record<string, unknown>).DeviceOrientationEvent = class {};
    await act(async () => { await useCompassStore.getState().enable(); });
    act(() => { useCompassStore.getState().disable(); });

    useSettingsStore.setState(DEFAULT_SETTINGS);
    const event = new Event('deviceorientation') as DeviceOrientationEvent;
    Object.defineProperty(event, 'alpha', { value: 270, configurable: true });
    act(() => { window.dispatchEvent(event); });

    expect(useSettingsStore.getState().headingDeg).toBe(DEFAULT_SETTINGS.headingDeg);
  });
});
```

- [ ] **Step 2: Run tests — confirm they all fail**

```bash
npx vitest run src/hooks/useCompass.test.ts
```

Expected: FAIL — `Cannot find module './useCompass'`

- [ ] **Step 3: Implement `src/hooks/useCompass.ts`**

```ts
import { create } from 'zustand';
import { useSettingsStore } from './useSettings';

interface CompassState {
  isActive: boolean;
  error: 'denied' | 'unsupported' | null;
  enable: () => Promise<void>;
  disable: () => void;
}

// Module-level refs so disable() can remove the exact same function reference.
let _listener: ((e: DeviceOrientationEvent) => void) | null = null;
let _eventName: string | null = null;

export const useCompassStore = create<CompassState>()((set) => ({
  isActive: false,
  error: null,

  enable: async () => {
    if (typeof (window as unknown as Record<string, unknown>).DeviceOrientationEvent === 'undefined') {
      set({ error: 'unsupported' });
      return;
    }
    const DOE = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<PermissionState>;
    };
    if (typeof DOE.requestPermission === 'function') {
      let permission: PermissionState;
      try {
        permission = await DOE.requestPermission();
      } catch {
        set({ error: 'denied' });
        return;
      }
      if (permission !== 'granted') {
        set({ error: 'denied' });
        return;
      }
    }
    _listener = (e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      const heading = e.alpha ?? e.webkitCompassHeading;
      if (heading == null) return;
      useSettingsStore.getState().update({ headingDeg: Math.round(heading) % 360 });
    };
    _eventName = 'ondeviceorientationabsolute' in window
      ? 'deviceorientationabsolute'
      : 'deviceorientation';
    window.addEventListener(_eventName, _listener as EventListener);
    set({ isActive: true, error: null });
  },

  disable: () => {
    if (_listener && _eventName) {
      window.removeEventListener(_eventName, _listener as EventListener);
      _listener = null;
      _eventName = null;
    }
    set({ isActive: false });
  },
}));
```

- [ ] **Step 4: Run tests — confirm they all pass**

```bash
npx vitest run src/hooks/useCompass.test.ts
```

Expected: 8 tests passing.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
npm test
```

Expected: all tests passing.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useCompass.ts src/hooks/useCompass.test.ts
git commit -m "feat(compass): add useCompassStore with orientation listener and iOS permission"
```

---

### Task 2: SettingsModal compass UI

**Files:**
- Modify: `src/components/SettingsPanel/SettingsModal.tsx` (lines 1–3 imports, lines 106–122 heading section)
- Create: `src/components/SettingsPanel/SettingsModal.test.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write the failing render tests**

Create `src/components/SettingsPanel/SettingsModal.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SettingsModal } from './SettingsModal';
import { useCompassStore } from '../../hooks/useCompass';
import { useSettingsStore } from '../../hooks/useSettings';
import { DEFAULT_SETTINGS } from '../../types/aircraft';

beforeEach(() => {
  useCompassStore.setState({ isActive: false, error: null });
  useSettingsStore.setState(DEFAULT_SETTINGS);
  // Make DeviceOrientationEvent available so unsupported path is not taken
  (window as unknown as Record<string, unknown>).DeviceOrientationEvent = class {};
});

describe('SettingsModal compass UI', () => {
  it('renders "Use compass" button when compass is inactive and supported', () => {
    render(<SettingsModal onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /use compass/i })).toBeInTheDocument();
  });

  it('shows the heading input when compass is inactive', () => {
    render(<SettingsModal onClose={() => {}} />);
    expect(screen.getByLabelText(/radar heading/i)).toBeInTheDocument();
  });

  it('hides the heading input when compass is active', () => {
    act(() => { useCompassStore.setState({ isActive: true, error: null }); });
    render(<SettingsModal onClose={() => {}} />);
    expect(screen.queryByLabelText(/radar heading/i)).not.toBeInTheDocument();
  });

  it('shows compass active status with current heading when compass is active', () => {
    act(() => {
      useCompassStore.setState({ isActive: true, error: null });
      useSettingsStore.setState({ ...DEFAULT_SETTINGS, headingDeg: 90 });
    });
    render(<SettingsModal onClose={() => {}} />);
    expect(screen.getByText(/Compass active · 90°/)).toBeInTheDocument();
  });

  it('shows "Stop" button when compass is active', () => {
    act(() => { useCompassStore.setState({ isActive: true, error: null }); });
    render(<SettingsModal onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
  });

  it('shows denied message when error is denied', () => {
    act(() => { useCompassStore.setState({ isActive: false, error: 'denied' }); });
    render(<SettingsModal onClose={() => {}} />);
    expect(screen.getByText(/compass permission denied/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /use compass/i })).not.toBeInTheDocument();
  });

  it('does not show compass button when DeviceOrientationEvent is unsupported', () => {
    act(() => { useCompassStore.setState({ isActive: false, error: 'unsupported' }); });
    render(<SettingsModal onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: /use compass/i })).not.toBeInTheDocument();
    // Manual input still visible
    expect(screen.getByLabelText(/radar heading/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npx vitest run src/components/SettingsPanel/SettingsModal.test.tsx
```

Expected: FAIL — compass button not found (not yet added).

- [ ] **Step 3: Add import and hook in SettingsModal**

In `src/components/SettingsPanel/SettingsModal.tsx`, change line 3 imports:

```tsx
import { useState } from 'react';
import { useSettingsStore } from '../../hooks/useSettings';
import { useCompassStore } from '../../hooks/useCompass';
import type { LabelCondition } from '../../types/aircraft';
```

Inside the `SettingsModal` component body (after the `settings` line), add:

```tsx
const compass = useCompassStore();
```

- [ ] **Step 4: Replace the heading section in SettingsModal**

Replace the current heading block (the `<label>Radar heading…</label>` and `.modal-hint` div, lines 106–122) with:

```tsx
{compass.error !== 'unsupported' ? (
  <>
    {!compass.isActive && (
      <>
        <label>
          Radar heading (°)
          <input
            type="number"
            min={0}
            max={359}
            step={1}
            value={settings.headingDeg}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              if (!isNaN(v)) settings.update({ headingDeg: Math.min(359, Math.max(0, v)) });
            }}
          />
        </label>
        <div className="modal-hint">
          0 = north-up · rotates radar so your heading faces top
        </div>
      </>
    )}
    {compass.isActive && (
      <div className="compass-status">
        Compass active · {settings.headingDeg}°
      </div>
    )}
    {compass.error === 'denied' && (
      <div className="modal-hint">Compass permission denied</div>
    )}
    {!compass.isActive && compass.error !== 'denied' && (
      <button className="geo-btn" onClick={() => compass.enable()}>
        Use compass
      </button>
    )}
    {compass.isActive && (
      <button className="geo-btn" onClick={() => compass.disable()}>
        Stop
      </button>
    )}
  </>
) : (
  <>
    <label>
      Radar heading (°)
      <input
        type="number"
        min={0}
        max={359}
        step={1}
        value={settings.headingDeg}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          if (!isNaN(v)) settings.update({ headingDeg: Math.min(359, Math.max(0, v)) });
        }}
      />
    </label>
    <div className="modal-hint">
      0 = north-up · rotates radar so your heading faces top
    </div>
  </>
)}
```

- [ ] **Step 5: Add `.compass-status` CSS**

In `src/index.css`, add after the `.modal-hint` rule:

```css
.compass-status {
  font-size: 13px;
  color: var(--text-muted, #aaa);
  padding: 4px 0;
}
```

- [ ] **Step 6: Run tests — confirm they all pass**

```bash
npx vitest run src/components/SettingsPanel/SettingsModal.test.tsx
```

Expected: 7 tests passing.

- [ ] **Step 7: Run full test suite to check for regressions**

```bash
npm test
```

Expected: all tests passing.

- [ ] **Step 8: Commit**

```bash
git add src/components/SettingsPanel/SettingsModal.tsx \
        src/components/SettingsPanel/SettingsModal.test.tsx \
        src/index.css
git commit -m "feat(compass): add compass mode UI to SettingsModal"
```
