# Geolocation Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Use my location" button between the Latitude and Longitude fields in the Settings modal that auto-fills both values via the browser Geolocation API.

**Architecture:** All changes are self-contained in `SettingsModal.tsx`. A local `geoStatus` state drives three button states (idle → loading → error). On success the existing `settings.update()` is called with the coordinates; on error the button turns red and clicking it retries.

**Tech Stack:** React (useState), browser Geolocation API (`navigator.geolocation.getCurrentPosition`), Zustand settings store (already wired).

---

### Task 1: Add geolocation handler and button to SettingsModal

**Files:**
- Modify: `src/components/SettingsPanel/SettingsModal.tsx`

- [ ] **Step 1: Open the file and read the current structure**

  File: `src/components/SettingsPanel/SettingsModal.tsx`
  
  Confirm the Latitude and Longitude `<label>` blocks are adjacent in the modal body (lines ~19–37).

- [ ] **Step 2: Add the geoStatus state and handler**

  Replace the top of the component (after the `settings` line) to add state and handler:

  ```tsx
  import { useState } from 'react';
  import { useSettingsStore } from '../../hooks/useSettings';

  interface Props {
    onClose: () => void;
  }

  export function SettingsModal({ onClose }: Props) {
    const settings = useSettingsStore();
    const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'error'>('idle');

    function handleGeolocate() {
      setGeoStatus('loading');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          settings.update({
            lat: parseFloat(pos.coords.latitude.toFixed(4)),
            lng: parseFloat(pos.coords.longitude.toFixed(4)),
          });
          setGeoStatus('idle');
        },
        () => {
          setGeoStatus('error');
        }
      );
    }
  ```

- [ ] **Step 3: Insert the button between Latitude and Longitude labels**

  The modal body should look like this after the edit:

  ```tsx
  <div className="modal-body">
    <label>
      Latitude
      <input
        type="number"
        step="0.0001"
        value={settings.lat}
        onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) settings.update({ lat: v }); }}
      />
    </label>

    <button
      className={`geo-btn${geoStatus === 'error' ? ' geo-btn--error' : ''}`}
      onClick={handleGeolocate}
      disabled={geoStatus === 'loading'}
    >
      {geoStatus === 'idle' && '📍 Use my location'}
      {geoStatus === 'loading' && '⏳ Detecting…'}
      {geoStatus === 'error' && '⚠ Permission denied — tap to retry'}
    </button>

    <label>
      Longitude
      <input
        type="number"
        step="0.0001"
        value={settings.lng}
        onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) settings.update({ lng: v }); }}
      />
    </label>

    {/* remaining fields unchanged */}
  ```

- [ ] **Step 4: Add CSS for the button states**

  Open `src/index.css` and append these rules:

  ```css
  .geo-btn {
    width: 100%;
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--border, #444);
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 0.85rem;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .geo-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .geo-btn--error {
    border-color: #e05252;
    color: #e05252;
  }
  ```

- [ ] **Step 5: Verify it compiles**

  ```bash
  cd /mnt/storage/shared/projects/personal/flight-tracker && npm run build 2>&1 | tail -20
  ```

  Expected: no TypeScript errors, build succeeds.

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/SettingsPanel/SettingsModal.tsx src/index.css
  git commit -m "feat: add geolocation button to settings modal"
  ```
