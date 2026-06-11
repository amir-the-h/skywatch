# Compass Mode Design

## Goal

Add a "Use compass" toggle to the settings panel that automatically drives `headingDeg` from the device's compass bearing using `deviceorientationabsolute`. When active, the manual heading input is hidden.

## Architecture

A dedicated non-persisted Zustand store (`useCompass`) holds compass state. It owns the `DeviceOrientation` event listener lifecycle and pipes `event.alpha` → `useSettingsStore.update({ headingDeg })` on each event. The existing `headingDeg` pipeline in `RadarView` and `RadarCanvas` is unchanged — compass mode is purely a feeder into that existing path.

## Components

### `src/hooks/useCompass.ts` (new file)

Zustand store (no `persist` middleware):

```ts
interface CompassState {
  isActive: boolean;
  error: 'denied' | 'unsupported' | null;
  enable: () => Promise<void>;
  disable: () => void;
}
```

**`enable()` logic:**

1. Check that `window.DeviceOrientationEvent` exists. If not, set `error: 'unsupported'` and return.
2. If `DeviceOrientationEvent.requestPermission` exists (iOS 13+), call it. On `'denied'`, set `error: 'denied'` and return. On `'granted'`, continue.
3. Register a listener on `deviceorientationabsolute` with a fallback to `deviceorientation` (checking `event.webkitCompassHeading` for older iOS that only fires the non-absolute event).
4. Each event: `heading = event.alpha ?? event.webkitCompassHeading`. If heading is `null`/`undefined`, skip. Otherwise call `useSettingsStore.getState().update({ headingDeg: Math.round(heading) % 360 })`.
5. Set `isActive: true`.

**`disable()` logic:**
Remove the listener, set `isActive: false`.

**Listener reference:** store the listener function in a module-level variable (not in Zustand state) so `disable()` can remove the exact same function reference.

**Unsupported detection:** `window.DeviceOrientationEvent` is undefined on most desktop browsers. The UI hides the compass button in this case.

### `src/components/SettingsPanel/SettingsModal.tsx` (modified)

Replace the heading section (the `<label>` + `.modal-hint` div) with conditional rendering:

**When `isActive === false` and `error !== 'unsupported'`:**
- Show the existing heading `<label>` (number input)
- Show the existing `.modal-hint` div
- Show a "Use compass" button

**When `isActive === true`:**
- Hide the heading `<label>` and `.modal-hint` entirely
- Show: `Compass active · {settings.headingDeg}°` (static text, live value)
- Show a "Stop" button that calls `compass.disable()`

**When `error === 'denied'`:**
- Hide the compass button
- Show: `Compass permission denied` (one-line static text, styled like `.modal-hint`)

**When `error === 'unsupported'`:**
- Hide the compass button entirely
- Show the manual heading input and hint as normal (no compass UI)

The "Use compass" button calls `compass.enable()` — this must be triggered directly from the button's `onClick` handler to satisfy the iOS requirement that `requestPermission` is called from a user gesture.

## Data Flow

```
DeviceOrientationEvent (browser)
  → useCompass listener
  → useSettingsStore.update({ headingDeg })
  → RadarView reads headingDeg (unchanged path)
  → RadarCanvas renders with rotation (unchanged)
```

No changes to `RadarView`, `RadarCanvas`, `geoUtils`, or `src/types/aircraft.ts`.

## Error States

| State | UI |
|---|---|
| `isActive: false`, no error | Manual input + "Use compass" button |
| `isActive: true` | Status line + "Stop" button |
| `error: 'denied'` | "Compass permission denied" text, no button |
| `error: 'unsupported'` | No compass UI at all |

## Testing

- Unit test `useCompass` store logic with mock `DeviceOrientationEvent`
- Test that `enable()` sets `error: 'unsupported'` when `DeviceOrientationEvent` is undefined
- Test that a fired orientation event updates `headingDeg` via `useSettingsStore`
- Test that `disable()` sets `isActive: false`
- `SettingsModal` renders the compass button when `isActive: false` and `error` is null
- `SettingsModal` hides the heading input when `isActive: true`

## Non-Goals

- Compass heading is not persisted — user must re-enable on each page load (required for iOS anyway)
- No visual indicator outside the settings modal (e.g. no status icon on the radar view)
- No smoothing/low-pass filtering of orientation events (raw `Math.round` is sufficient)
