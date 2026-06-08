import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIdleCursor } from './useIdleCursor';

describe('useIdleCursor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.head.querySelectorAll('style').forEach(el => el.remove());
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
    expect(document.head.querySelector('style')).toBeNull();
  });

  it('hides cursor after 5s idle in fullscreen', () => {
    renderHook(() => useIdleCursor());
    act(() => { enterFullscreen(); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(document.head.querySelector('style')?.textContent).toBe('*{cursor:none!important}');
  });

  it('does not hide cursor before 5s elapses in fullscreen', () => {
    renderHook(() => useIdleCursor());
    act(() => { enterFullscreen(); });
    act(() => { vi.advanceTimersByTime(4999); });
    expect(document.head.querySelector('style')).toBeNull();
  });

  it('restores cursor on mouse move after it was hidden', () => {
    renderHook(() => useIdleCursor());
    act(() => { enterFullscreen(); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(document.head.querySelector('style')?.textContent).toBe('*{cursor:none!important}');
    act(() => { document.dispatchEvent(new MouseEvent('mousemove')); });
    expect(document.head.querySelector('style')).toBeNull();
  });

  it('resets idle timer on mouse move so cursor stays visible for another 5s', () => {
    renderHook(() => useIdleCursor());
    act(() => { enterFullscreen(); });
    act(() => { vi.advanceTimersByTime(4000); });
    act(() => { document.dispatchEvent(new MouseEvent('mousemove')); });
    act(() => { vi.advanceTimersByTime(4999); });
    expect(document.head.querySelector('style')).toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(document.head.querySelector('style')?.textContent).toBe('*{cursor:none!important}');
  });

  it('restores cursor and clears timer when leaving fullscreen', () => {
    renderHook(() => useIdleCursor());
    act(() => { enterFullscreen(); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(document.head.querySelector('style')?.textContent).toBe('*{cursor:none!important}');
    act(() => { exitFullscreen(); });
    expect(document.head.querySelector('style')).toBeNull();
    // No further timer fires
    act(() => { vi.advanceTimersByTime(5000); });
    expect(document.head.querySelector('style')).toBeNull();
  });

  it('restores cursor on unmount', () => {
    const { unmount } = renderHook(() => useIdleCursor());
    act(() => { enterFullscreen(); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(document.head.querySelector('style')?.textContent).toBe('*{cursor:none!important}');
    act(() => { unmount(); });
    expect(document.head.querySelector('style')).toBeNull();
  });

  it('hides cursor after 5s if already in fullscreen when hook mounts', () => {
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => document.body,
    });
    renderHook(() => useIdleCursor());
    act(() => { vi.advanceTimersByTime(5000); });
    expect(document.head.querySelector('style')?.textContent).toBe('*{cursor:none!important}');
  });
});
