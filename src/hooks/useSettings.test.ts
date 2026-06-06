import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettingsStore } from './useSettings';
import { DEFAULT_SETTINGS } from '../types/aircraft';

beforeEach(() => {
  localStorage.clear();
  useSettingsStore.setState(DEFAULT_SETTINGS);
});

describe('useSettings', () => {
  it('initializes with DEFAULT_SETTINGS', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.lat).toBe(DEFAULT_SETTINGS.lat);
    expect(result.current.theme).toBe('dark');
  });

  it('updates a single setting', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => result.current.update({ theme: 'light' }));
    expect(result.current.theme).toBe('light');
  });

  it('persists updated setting to localStorage', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => result.current.update({ lat: 51.5 }));
    const stored = JSON.parse(localStorage.getItem('ft-settings')!);
    expect(stored.state.lat).toBe(51.5);
  });
});
