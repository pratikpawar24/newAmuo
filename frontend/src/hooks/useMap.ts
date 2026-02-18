'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import type { RouteResult, OrionRouteResult, ParetoRoute } from '@/types/traffic';

interface RouteWeights {
  alpha: number;
  beta: number;
  gamma: number;
}

export function useMap() {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [paretoRoutes, setParetoRoutes] = useState<ParetoRoute[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('balanced');
  const [isCalculating, setIsCalculating] = useState(false);
  const [algorithmInfo, setAlgorithmInfo] = useState<string | null>(null);

  const calculateRoute = useCallback(
    async (
      origin: { lat: number; lng: number },
      destination: { lat: number; lng: number },
      weights: RouteWeights = { alpha: 0.5, beta: 0.3, gamma: 0.2 }
    ) => {
      setIsCalculating(true);
      try {
        const { data } = await api.post('/routes/calculate', { origin, destination, weights });
        const result = data.data as OrionRouteResult | RouteResult;
        setRoute(result);
        if ('algorithm' in result) {
          setAlgorithmInfo(result.algorithm);
        }
        return result;
      } catch {
        setRoute(null);
        return null;
      } finally {
        setIsCalculating(false);
      }
    },
    []
  );

  const calculateParetoRoutes = useCallback(
    async (
      origin: { lat: number; lng: number },
      destination: { lat: number; lng: number }
    ) => {
      setIsCalculating(true);
      try {
        const { data } = await api.post('/routes/pareto', {
          origin,
          destination,
          departureTime: new Date().toISOString(),
        });
        if (data.success && data.data?.routes) {
          const routes = data.data.routes as ParetoRoute[];
          setParetoRoutes(routes);
          // Select balanced by default
          const balanced = routes.find((r) => r.name === 'balanced') || routes[0];
          if (balanced) {
            setRoute(balanced.route);
            setSelectedPreset(balanced.name);
            setAlgorithmInfo(balanced.route?.algorithm || 'AUMO-ORION');
          }
          return routes;
        }
        return [];
      } catch {
        setParetoRoutes([]);
        return [];
      } finally {
        setIsCalculating(false);
      }
    },
    []
  );

  const selectParetoRoute = useCallback(
    (presetName: string) => {
      const found = paretoRoutes.find((r) => r.name === presetName);
      if (found) {
        setRoute(found.route);
        setSelectedPreset(presetName);
        setAlgorithmInfo(found.route?.algorithm || 'AUMO-ORION');
      }
    },
    [paretoRoutes]
  );

  const clearRoute = useCallback(() => {
    setRoute(null);
    setParetoRoutes([]);
    setAlgorithmInfo(null);
  }, []);

  return {
    route,
    paretoRoutes,
    selectedPreset,
    isCalculating,
    algorithmInfo,
    calculateRoute,
    calculateParetoRoutes,
    selectParetoRoute,
    clearRoute,
  };
}
