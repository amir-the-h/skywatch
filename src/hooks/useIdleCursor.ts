import { useEffect } from 'react';

const IDLE_MS = 5000;

let styleEl: HTMLStyleElement | null = null;

function showCursor() {
  styleEl?.remove();
  styleEl = null;
}

function hideCursor() {
  if (styleEl) return;
  styleEl = document.createElement('style');
  styleEl.textContent = '*{cursor:none!important}';
  document.head.appendChild(styleEl);
}

export function useIdleCursor(): void {
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null;

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
    onFullscreenChange(); // handle already-fullscreen on mount

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('mousemove', resetTimer);
      clearTimer();
      showCursor();
    };
  }, []);
}
