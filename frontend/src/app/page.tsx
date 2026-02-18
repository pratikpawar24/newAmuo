'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import AddressAutocomplete from '@/components/map/AddressAutocomplete';
import WeightSlider from '@/components/ui/WeightSlider';
import Button from '@/components/ui/Button';
import { useMap } from '@/hooks/useMap';
import { useAuth } from '@/hooks/useAuth';
import { useGeolocation } from '@/hooks/useGeolocation';
import { formatDistance, formatDuration, formatCO2 } from '@/lib/utils';
import type { OrionRouteResult } from '@/types/traffic';

const MapView = dynamic(() => import('@/components/map/MapView'), { ssr: false });
const RoutePolyline = dynamic(() => import('@/components/map/RoutePolyline'), { ssr: false });
const TrafficHeatmap = dynamic(() => import('@/components/map/TrafficHeatmap'), { ssr: false });

interface LatLng { lat: number; lng: number }

const PARETO_PRESETS = [
  { name: 'fastest', icon: '⚡', label: 'Fastest' },
  { name: 'greenest', icon: '🌿', label: 'Greenest' },
  { name: 'balanced', icon: '⚖️', label: 'Balanced' },
  { name: 'smoothest', icon: '🛣️', label: 'Smoothest' },
];

export default function HomePage() {
  useAuth();
  const {
    route, paretoRoutes, selectedPreset, isCalculating, algorithmInfo,
    calculateRoute, calculateParetoRoutes, selectParetoRoute, clearRoute,
  } = useMap();
  const { lat: gpsLat, lng: gpsLng, loading: gpsLoading, error: gpsError, requestLocation } = useGeolocation(true);
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [originLabel, setOriginLabel] = useState('');
  const [weights, setWeights] = useState({ alpha: 0.5, beta: 0.3, gamma: 0.2 });
  const [routeMode, setRouteMode] = useState<'standard' | 'pareto'>('standard');

  // Auto-set origin to GPS location when available and no origin is selected
  useEffect(() => {
    if (gpsLat && gpsLng && !origin) {
      setOrigin({ lat: gpsLat, lng: gpsLng });
      setOriginLabel('📍 My Location');
    }
  }, [gpsLat, gpsLng, origin]);

  const handleUseMyLocation = () => {
    if (gpsLat && gpsLng) {
      setOrigin({ lat: gpsLat, lng: gpsLng });
      setOriginLabel('📍 My Location');
    } else {
      requestLocation();
    }
  };

  const normalizeWeights = useCallback((key: 'alpha' | 'beta' | 'gamma', value: number) => {
    const others = Object.keys(weights).filter((k) => k !== key) as Array<'alpha' | 'beta' | 'gamma'>;
    const remaining = 1 - value;
    const otherSum = weights[others[0]] + weights[others[1]];
    const newWeights = { ...weights, [key]: value };
    if (otherSum > 0) {
      newWeights[others[0]] = (weights[others[0]] / otherSum) * remaining;
      newWeights[others[1]] = (weights[others[1]] / otherSum) * remaining;
    } else {
      newWeights[others[0]] = remaining / 2;
      newWeights[others[1]] = remaining / 2;
    }
    setWeights(newWeights);
  }, [weights]);

  const handleCalculate = () => {
    if (!origin || !destination) return;
    if (routeMode === 'pareto') {
      calculateParetoRoutes(origin, destination);
    } else {
      calculateRoute(origin, destination, weights);
    }
  };

  const orionRoute = route as OrionRouteResult | null;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 flex-col lg:flex-row">
        {/* Sidebar panel */}
        <div className="w-full border-r border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 lg:w-96 overflow-y-auto max-h-[calc(100vh-4rem)]">
          <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">🗺️ Route Planner</h2>

          {/* Algorithm badge */}
          {algorithmInfo && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 px-3 py-1.5 dark:from-indigo-900/30 dark:to-purple-900/30">
              <span className="text-sm">🧠</span>
              <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">{algorithmInfo}</span>
            </div>
          )}

          <div className="space-y-4">
            <AddressAutocomplete
              label="Origin"
              placeholder="Start location..."
              value={originLabel}
              onSelect={(r) => {
                setOrigin({ lat: r.lat, lng: r.lng });
                setOriginLabel(r.display_name.split(',').slice(0, 2).join(', '));
              }}
            />
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={gpsLoading}
              className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 disabled:opacity-50 -mt-2"
            >
              {gpsLoading ? (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              ) : (
                <span>📍</span>
              )}
              {gpsLoading ? 'Getting location...' : gpsError ? 'Retry GPS Location' : 'Use My Location'}
            </button>
            <AddressAutocomplete
              label="Destination"
              placeholder="End location..."
              onSelect={(r) => setDestination({ lat: r.lat, lng: r.lng })}
            />

            {/* Route mode toggle */}
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setRouteMode('standard')}
                className={`flex-1 py-2 text-xs font-semibold transition-colors ${routeMode === 'standard' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}
              >
                ⚙️ Custom Weights
              </button>
              <button
                type="button"
                onClick={() => setRouteMode('pareto')}
                className={`flex-1 py-2 text-xs font-semibold transition-colors ${routeMode === 'pareto' ? 'bg-indigo-500 text-white' : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}
              >
                🧠 ORION Pareto
              </button>
            </div>

            {routeMode === 'standard' && (
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Route Optimization Weights</p>
                <div className="space-y-3">
                  <WeightSlider label="Time" icon="⏱️" value={weights.alpha} onChange={(v) => normalizeWeights('alpha', v)} color="blue" />
                  <WeightSlider label="Emissions" icon="🌿" value={weights.beta} onChange={(v) => normalizeWeights('beta', v)} color="green" />
                  <WeightSlider label="Distance" icon="📏" value={weights.gamma} onChange={(v) => normalizeWeights('gamma', v)} color="amber" />
                </div>
              </div>
            )}

            <Button onClick={handleCalculate} isLoading={isCalculating} disabled={!origin || !destination} className="w-full" size="lg">
              {routeMode === 'pareto' ? '🧠 Find Pareto Routes' : 'Calculate Route'}
            </Button>

            {/* Pareto route selector */}
            {paretoRoutes.length > 0 && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-800 dark:bg-indigo-900/20">
                <p className="mb-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300">Pareto-Optimal Routes</p>
                <div className="grid grid-cols-2 gap-2">
                  {PARETO_PRESETS.map((preset) => {
                    const pr = paretoRoutes.find((r) => r.name === preset.name);
                    if (!pr) return null;
                    const isActive = selectedPreset === preset.name;
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => selectParetoRoute(preset.name)}
                        className={`rounded-lg border p-2 text-left transition-all ${isActive ? 'border-indigo-400 bg-indigo-100 dark:border-indigo-500 dark:bg-indigo-800/40 ring-1 ring-indigo-400' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 hover:border-indigo-300'}`}
                      >
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-sm">{preset.icon}</span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{preset.label}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
                          <p>{formatDistance(pr.route.distance_km)} · {formatDuration(pr.route.duration_min)}</p>
                          <p className="text-green-600 dark:text-green-400">{formatCO2(pr.route.emissions_g)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {route && (
              <div className="animate-slide-up rounded-xl border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-900/20">
                <h3 className="mb-2 font-semibold text-primary-800 dark:text-primary-300">Route Result</h3>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{formatDistance(route.distance_km)}</p>
                    <p className="text-xs text-slate-500">Distance</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{formatDuration(route.duration_min)}</p>
                    <p className="text-xs text-slate-500">Duration</p>
                  </div>
                  <div>
                    <p className="font-bold text-green-600">{formatCO2(route.emissions_g)}</p>
                    <p className="text-xs text-slate-500">CO₂</p>
                  </div>
                </div>

                {/* ORION extra info */}
                {orionRoute?.efficiency_ratio !== undefined && (
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-primary-200 pt-3 dark:border-primary-700">
                    <div className="text-center">
                      <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{(orionRoute.efficiency_ratio * 100).toFixed(1)}%</p>
                      <p className="text-[10px] text-slate-500">Efficiency</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-purple-600 dark:text-purple-400">{orionRoute.search_time_ms?.toFixed(0) || '—'} ms</p>
                      <p className="text-[10px] text-slate-500">Search Time</p>
                    </div>
                  </div>
                )}

                {/* Segment congestion legend */}
                {orionRoute?.segments && orionRoute.segments.length > 0 && (
                  <div className="mt-3 border-t border-primary-200 pt-3 dark:border-primary-700">
                    <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Congestion Legend</p>
                    <div className="flex items-center gap-1 text-[9px] text-slate-500">
                      <span className="inline-block w-3 h-2 rounded-sm" style={{backgroundColor:'#22c55e'}} /> Free
                      <span className="inline-block w-3 h-2 rounded-sm ml-1" style={{backgroundColor:'#eab308'}} /> Light
                      <span className="inline-block w-3 h-2 rounded-sm ml-1" style={{backgroundColor:'#f97316'}} /> Moderate
                      <span className="inline-block w-3 h-2 rounded-sm ml-1" style={{backgroundColor:'#ef4444'}} /> Heavy
                      <span className="inline-block w-3 h-2 rounded-sm ml-1" style={{backgroundColor:'#991b1b'}} /> Gridlock
                    </div>
                  </div>
                )}

                <button onClick={clearRoute} className="mt-3 w-full text-xs text-slate-500 hover:text-red-500">
                  Clear route
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1">
          <MapView center={origin ? [origin.lat, origin.lng] : gpsLat && gpsLng ? [gpsLat, gpsLng] : [18.5204, 73.8567]} zoom={13}>
            {route && <RoutePolyline route={route} />}
          </MapView>
        </div>
      </main>
      <Footer />
    </div>
  );
}
