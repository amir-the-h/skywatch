import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { BackendAircraft } from '../../shared/types';
import { useAircraftStore } from '../store/aircraftStore';
import { useSettingsStore } from './useSettings';

export function useAircraftSocket(): void {
  const socketRef = useRef<Socket | null>(null);
  const { mergeAircraft } = useAircraftStore();
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

    socket.on('aircraft_update', (data: { aircraft: BackendAircraft[] }) => {
      mergeAircraft(data.aircraft);
    });

    return () => {
      socket.disconnect();
    };
  }, [mergeAircraft]);

  // Register location on connect and when settings change
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    if (socket.connected) {
      socket.emit('register_location', {
        lat,
        lon: lng,
        radiusKm,
      });
    } else {
      // If socket not yet connected, register once it connects
      socket.once('connect', () => {
        socket.emit('register_location', {
          lat,
          lon: lng,
          radiusKm,
        });
      });
    }
  }, [lat, lng, radiusKm]);
}
