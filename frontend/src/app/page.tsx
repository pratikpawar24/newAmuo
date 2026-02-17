'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import AddressAutocomplete from '@/components/map/AddressAutocomplete';
import WeightSlider from '@/components/ui/WeightSlider';
import Button from '@/components/ui/Button';
import { useMap } from '@/hooks/useMap';
import { useAuth } from '@/hooks/useAuth';
import { formatDistance, formatDuration, formatCO2 } from '@/lib/utils';

const MapView = dynamic(() => import('@/components/map/MapView'), { ssr: false });
const RoutePolyline = dynamic(() => import('@/components/map/RoutePolyline'), { ssr: false });
const TrafficHeatmap = dynamic(() => import('@/components/map/TrafficHeatmap'), { ssr: false });

interface LatLng { lat: number; lng: number }

export default function HomePage() {
  useAuth();
  const { route, isCalculating, calculateRoute, clearRoute } = useMap();
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [weights, setWeights] = useState({ alpha: 0.5, beta: 0.3, gamma: 0.2 });

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
    if (origin && destination) calculateRoute(origin, destination, weights);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 flex-col lg:flex-row">
        {/* Sidebar panel */}
        <div className="w-full border-r border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 lg:w-96">
          <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">🗺️ Route Planner</h2>

          <div className="space-y-4">
            <AddressAutocomplete
              label="Origin"
              placeholder="Start location..."
              onSelect={(r) => setOrigin({ lat: r.lat, lng: r.lng })}
            />
            <AddressAutocomplete
              label="Destination"
              placeholder="End location..."
              onSelect={(r) => setDestination({ lat: r.lat, lng: r.lng })}
            />

            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Route Optimization Weights</p>
              <div className="space-y-3">
                <WeightSlider label="Time" icon="⏱️" value={weights.alpha} onChange={(v) => normalizeWeights('alpha', v)} color="blue" />
                <WeightSlider label="Emissions" icon="🌿" value={weights.beta} onChange={(v) => normalizeWeights('beta', v)} color="green" />
                <WeightSlider label="Distance" icon="📏" value={weights.gamma} onChange={(v) => normalizeWeights('gamma', v)} color="amber" />
              </div>
            </div>

            <Button onClick={handleCalculate} isLoading={isCalculating} disabled={!origin || !destination} className="w-full" size="lg">
              Calculate Route
            </Button>

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
                <button onClick={clearRoute} className="mt-3 w-full text-xs text-slate-500 hover:text-red-500">
                  Clear route
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1">
          <MapView center={origin ? [origin.lat, origin.lng] : [19.076, 72.8777]} zoom={13}>
            {route && <RoutePolyline route={route} />}
          </MapView>
        </div>
      </main>
      <Footer />
    </div>
  );
}
