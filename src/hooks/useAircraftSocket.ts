import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { BackendAircraft } from '../../shared/types';
import { useAircraftStore } from '../store/aircraftStore';
import { useSettingsStore } from './useSettings';

export function useAircraftSocket(): void {
  const socketRef = useRef<Socket | null>(null);
  const { mergeAircraft, removeStale } = useAircraftStore();
  const { lat, lng, radiusKm } = useSettingsStore();

  // Connect on mount, set up listener, cleanup on unmount
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    if (!backendUrl) {
      console.warn('VITE_BACKEND_URL not set; Socket.io connection disabled');
      return;
    }

    const socket = io(backendUrl);
    socketRef.current = socket;

    socket.on('aircraft_update', (data: { aircraft: BackendAircraft[]; fetchedAt: number }) => {
      mergeAircraft(data.aircraft, data.fetchedAt);
      removeStale(new Set(data.aircraft.map((ac) => ac.hex)));
    });

    return () => {
      socket.disconnect();
    };
  }, [mergeAircraft, removeStale]);

  // Register location on every connect (initial + reconnect) and when settings change
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const registerLocation = () => {
      socket.emit('register_location', { lat, lon: lng, radiusKm });
    };

    if (socket.connected) {
      registerLocation();
    }

    socket.on('connect', registerLocation);
    return () => {
      socket.off('connect', registerLocation);
    };
  }, [lat, lng, radiusKm]);

  // Force reconnect when tab becomes visible after sleep/suspend
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const socket = socketRef.current;
        if (socket && !socket.connected) {
          socket.connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);
}
