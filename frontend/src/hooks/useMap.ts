'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import type { RouteResult } from '@/types/traffic';

interface RouteWeights {
  alpha: number;
  beta: number;
  gamma: number;
}

export function useMap() {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const calculateRoute = useCallback(
    async (
      origin: { lat: number; lng: number },
      destination: { lat: number; lng: number },
      weights: RouteWeights = { alpha: 0.5, beta: 0.3, gamma: 0.2 }
    ) => {
      setIsCalculating(true);
      try {
        const { data } = await api.post('/routes/calculate', { origin, destination, weights });
        if (data.success && data.data?.path?.length >= 2) {
          setRoute(data.data);
          return data.data as RouteResult;
        }
        toast.error('No route found — try different locations');
        setRoute(null);
        return null;
      } catch {
        toast.error('Route calculation failed — please try again');
        setRoute(null);
        return null;
      } finally {
        setIsCalculating(false);
      }
    },
    []
  );

  const clearRoute = useCallback(() => setRoute(null), []);

  return { route, isCalculating, calculateRoute, clearRoute };
}
