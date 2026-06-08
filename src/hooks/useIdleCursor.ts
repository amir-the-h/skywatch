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
