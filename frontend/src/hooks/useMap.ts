'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
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
        setRoute(data.data);
        return data.data as RouteResult;
      } catch {
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
