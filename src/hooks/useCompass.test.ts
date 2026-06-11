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
