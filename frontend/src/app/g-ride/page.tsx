'use client';

import { useEffect, useState, useCallback } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import RideList from '@/components/ride/RideList';
import Button from '@/components/ui/Button';
import AddressAutocomplete from '@/components/map/AddressAutocomplete';
import { useRides } from '@/hooks/useRides';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function GRidePage() {
  const { isAuthenticated } = useAuth();
  const { rides, isLoading, pagination, fetchRides } = useRides(false); // don't auto-fetch, we control it

  const [origin, setOrigin] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [destination, setDestination] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Load all rides on mount (default view)
  useEffect(() => {
    fetchRides({});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGPS = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        // Reverse geocode with Nominatim
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16`
          );
          const data = await resp.json();
          const addr = data.display_name?.split(',').slice(0, 2).join(', ') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          setOrigin({ address: addr, lat: latitude, lng: longitude });
          toast.success('GPS location set as origin');
        } catch {
          setOrigin({ address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, lat: latitude, lng: longitude });
        }
        setGpsLoading(false);
      },
      (err) => {
        toast.error('Could not get location: ' + err.message);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleSearch = useCallback(() => {
    if (!origin || !destination) {
      toast.error('Select both origin and destination to search rides');
      return;
    }
    setHasSearched(true);
    fetchRides({
      originLat: origin.lat,
      originLng: origin.lng,
      destLat: destination.lat,
      destLng: destination.lng,
      radius: 3,
    });
  }, [origin, destination, fetchRides]);

  const handleClearSearch = useCallback(() => {
    setOrigin(null);
    setDestination(null);
    setHasSearched(false);
    fetchRides({});
  }, [fetchRides]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">🚗 G-Ride</h1>
            <p className="text-sm text-slate-500">Find rides along your route, save the planet</p>
          </div>
          {isAuthenticated && (
            <Link href="/g-ride/create">
              <Button size="lg">+ Create Ride</Button>
            </Link>
          )}
        </div>

        {/* Route Search Panel */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">🔍 Find rides on your route</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="relative">
              <AddressAutocomplete
                label="From (Origin)"
                placeholder="Where are you starting from?"
                value={origin?.address}
                onSelect={(r) => setOrigin({ address: r.display_name.split(',').slice(0, 2).join(', '), lat: r.lat, lng: r.lng })}
              />
              <button
                type="button"
                onClick={handleGPS}
                disabled={gpsLoading}
                className="absolute right-2 top-8 rounded-lg bg-primary-50 px-2 py-1 text-xs font-medium text-primary-600 transition hover:bg-primary-100 disabled:opacity-50 dark:bg-primary-900/30 dark:text-primary-400"
                title="Use GPS location"
              >
                {gpsLoading ? '⏳' : '📍 GPS'}
              </button>
            </div>
            <AddressAutocomplete
              label="To (Destination)"
              placeholder="Where are you going?"
              onSelect={(r) => setDestination({ address: r.display_name.split(',').slice(0, 2).join(', '), lat: r.lat, lng: r.lng })}
            />
          </div>

          {/* Selected locations info */}
          {(origin || destination) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {origin && <span className="rounded-full bg-primary-50 px-2 py-0.5 dark:bg-primary-900/20">📍 {origin.address}</span>}
              {origin && destination && <span>→</span>}
              {destination && <span className="rounded-full bg-red-50 px-2 py-0.5 dark:bg-red-900/20">🏁 {destination.address}</span>}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <Button
              onClick={handleSearch}
              disabled={!origin || !destination || isLoading}
              isLoading={isLoading}
              size="sm"
            >
              🔍 Search Rides on Route
            </Button>
            {hasSearched && (
              <Button onClick={handleClearSearch} size="sm" variant="ghost">
                ✕ Clear / Show All
              </Button>
            )}
          </div>
        </div>

        {/* Results */}
        {hasSearched && !isLoading && rides.length === 0 && (
          <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
            No rides found on your route. Try a wider search or create a ride for others to join!
          </div>
        )}

        <RideList
          rides={rides}
          isLoading={isLoading}
          emptyMessage={hasSearched ? 'No rides match your route.' : 'No active rides right now.'}
        />

        {pagination.pages > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            {Array.from({ length: pagination.pages }, (_, i) => (
              <button
                key={i}
                onClick={() => fetchRides({ page: i + 1 })}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  pagination.page === i + 1
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
