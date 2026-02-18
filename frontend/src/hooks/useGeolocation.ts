'use client';

import { useState, useEffect, useCallback } from 'react';

interface GeolocationState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
  supported: boolean;
}

export function useGeolocation(requestOnMount = true) {
  const [state, setState] = useState<GeolocationState>({
    lat: null,
    lng: null,
    accuracy: null,
    error: null,
    loading: requestOnMount,
    supported: typeof window !== 'undefined' && 'geolocation' in navigator,
  });

  const requestLocation = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setState((s) => ({ ...s, loading: false, supported: false, error: 'Geolocation not supported' }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          error: null,
          loading: false,
          supported: true,
        });
      },
      (err) => {
        setState((s) => ({
          ...s,
          loading: false,
          error: err.code === 1 ? 'Location permission denied' : err.message,
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000, // Cache location for 1 minute
      }
    );
  }, []);

  useEffect(() => {
    if (requestOnMount) {
      requestLocation();
    }
  }, [requestOnMount, requestLocation]);

  return { ...state, requestLocation };
}
