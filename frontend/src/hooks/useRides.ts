'use client';

import { useEffect } from 'react';
import { useRideStore } from '@/stores/rideStore';
import { useSocket } from './useSocket';
import type { RideFilters, CreateRidePayload } from '@/types/ride';

export function useRides(autoFetch = true, filters?: RideFilters) {
  const store = useRideStore();
  const { on } = useSocket();

  useEffect(() => {
    if (autoFetch) store.fetchRides(filters);
  }, [autoFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for real-time ride updates
  useEffect(() => {
    const unsub = on('ride:updated', () => {
      store.fetchRides(filters);
    });
    return unsub;
  }, [on, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  return store;
}
