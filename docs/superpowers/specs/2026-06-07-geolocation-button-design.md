# Design: Geolocation Button in Settings Modal

**Date:** 2026-06-07  
**Status:** Approved

## Problem

Users must manually type their latitude and longitude into the Settings modal. The browser's Geolocation API can fill these in automatically, but there's no affordance to trigger it.

## Solution

Add a "Use my location" button between the Latitude and Longitude fields in `SettingsModal.tsx`. The button calls `navigator.geolocation.getCurrentPosition` and fills both fields on success.

## Design

### Placement

Between the Latitude `<label>` and the Longitude `<label>` in the modal body.

### Button States

| State   | Label                  | Style       | Disabled |
|---------|------------------------|-------------|----------|
| idle    | "Use my location"      | default     | no       |
| loading | "Detecting…" + spinner | default     | yes      |
| error   | "⚠ Permission denied"  | red/warning | no       |

Clicking the error-state button retries: resets to `idle` and immediately calls geolocation again.

### State

Local React state inside `SettingsModal`: `geoStatus: 'idle' | 'loading' | 'error'`

No new files or hooks — state is ephemeral UI concern only.

### Behavior

1. User clicks button → `geoStatus` set to `'loading'`, button disabled
2. Browser prompts for location permission (first time)
3. **On success:** `settings.update({ lat, lng })` called with the returned coordinates; `geoStatus` reset to `'idle'`
4. **On error (denied/unavailable):** `geoStatus` set to `'error'`; button turns red with "⚠ Permission denied"
5. **Retry:** clicking the error-state button resets to `'idle'` and calls geolocation again immediately

### Files Changed

- `src/components/SettingsPanel/SettingsModal.tsx` — only file touched
