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
