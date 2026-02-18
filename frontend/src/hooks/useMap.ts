'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import type { RouteResult, OrionRouteResult, ParetoRoute } from '@/types/traffic';

interface RouteWeights {
  alpha: number;
  beta: number;
  gamma: number;
}

/**
 * Normalize the route object from the backend (camelCase, polyline arrays)
 * to the frontend RouteResult shape (snake_case, path objects).
 */
function normalizeRoute(raw: any): RouteResult | OrionRouteResult | null {
  if (!raw) return null;

  // The backend may wrap the route in a "primary" key
  const src = raw.primary ?? raw;

  // Build the `path` array the frontend expects: { lat, lng }[]
  const polyline: any[] = src.polyline || src.path || [];
  const path = polyline.map((p: any) => {
    if (Array.isArray(p)) return { lat: p[0], lng: p[1] };
    return { lat: p.lat, lng: p.lng };
  });

  const result: RouteResult = {
    path,
    distance_km: src.distanceKm ?? src.distance_km ?? 0,
    duration_min: src.durationMin ?? src.duration_min ?? 0,
    emissions_g: src.co2Grams ?? src.emissions_g ?? 0,
    cost: src.cost ?? 0,
  };

  // Merge ORION-specific fields if present
  if (src.algorithm || src.segments) {
    const orion = result as OrionRouteResult;
    orion.algorithm = src.algorithm || 'AUMO-ORION';
    orion.segments = src.segments || [];
    orion.efficiency_ratio = src.efficiency_ratio ?? src.efficiencyRatio ?? 0;
    orion.search_time_ms = src.search_time_ms ?? src.searchTimeMs ?? 0;
    orion.arrival_time = src.arrival_time ?? src.arrivalTime ?? '';
    orion.weights = src.weights ?? { alpha: 0.5, beta: 0.3, gamma: 0.2 };
    return orion;
  }

  return result;
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
        const { data } = await api.post('/routes/calculate', { origin, destination, weights, departureTime: new Date().toISOString() });
        const raw = data.data; // backend wraps in { success, data }
        const result = normalizeRoute(raw);
        setRoute(result);
        if (result && 'algorithm' in result) {
          setAlgorithmInfo((result as OrionRouteResult).algorithm);
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
          const routes: ParetoRoute[] = data.data.routes.map((r: any) => ({
            name: r.name,
            description: r.description || r.name,
            route: normalizeRoute(r.route || r) as OrionRouteResult,
          }));
          setParetoRoutes(routes);
          const balanced = routes.find((r) => r.name === 'balanced') || routes[0];
          if (balanced?.route) {
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
