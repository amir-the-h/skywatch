import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { BackendAircraft, AirportsPayload, MetarUpdatePayload, CenterWeatherPayload, EmergencyAircraft } from '../../shared/types';
import { useAircraftStore } from '../store/aircraftStore';
import { useAirportStore } from '../store/airportStore';
import { useMetarStore } from '../store/metarStore';
import { useCenterWeatherStore } from '../store/centerWeatherStore';
import { useEmergencyStore } from '../store/emergencyStore';
import { useSettingsStore } from './useSettings';

export function useAircraftSocket(): void {
  const socketRef = useRef<Socket | null>(null);
  const mergeAircraft = useAircraftStore((s) => s.mergeAircraft);
  const removeStale = useAircraftStore((s) => s.removeStale);
  const setAirports = useAirportStore((s) => s.setAirports);
  const mergeMetar = useMetarStore((s) => s.mergeMetar);
  const setCenterWeather = useCenterWeatherStore((s) => s.setCenterWeather);
  const setEmergency = useEmergencyStore((s) => s.setEmergency);
  const { lat, lng, radiusKm } = useSettingsStore();

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

    socket.on('airports', (data: AirportsPayload) => {
      setAirports(data.airports);
      mergeMetar(data.metar);
      setCenterWeather(data.centerWeather);
    });

    socket.on('metar_update', (data: MetarUpdatePayload) => {
      mergeMetar(data);
    });

    socket.on('center_weather', (data: CenterWeatherPayload) => {
      setCenterWeather(data);
    });

    socket.on('emergency_update', (data: EmergencyAircraft[]) => {
      setEmergency(data);
    });

    return () => {
      socket.disconnect();
    };
  }, [mergeAircraft, removeStale, setAirports, mergeMetar, setCenterWeather, setEmergency]);

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
