'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import RideList from '@/components/ride/RideList';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import AddressAutocomplete from '@/components/map/AddressAutocomplete';
import { useRideStore } from '@/stores/rideStore';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

interface Location {
  display_name: string;
  lat: number;
  lng: number;
}

export default function GRidePage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { rides, isLoading, pagination, fetchRides } = useRideStore();
  const router = useRouter();

  const [origin, setOrigin] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const handleSearch = async () => {
    if (!origin || !destination) return;
    setHasSearched(true);
    await fetchRides({
      originLat: origin.lat,
      originLng: origin.lng,
      destLat: destination.lat,
      destLng: destination.lng,
      radius: 15,
      limit: 50,
    });
  };

  if (authLoading) return <LoadingSpinner className="min-h-screen" size="lg" />;
  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">🚗 G-Ride</h1>
            <p className="text-sm text-slate-500">Search for rides by your route</p>
          </div>
          <Link href="/g-ride/create">
            <Button size="lg">+ Create Ride</Button>
          </Link>
        </div>

        {/* Search Form */}
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">🔍 Find a Ride</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <AddressAutocomplete
              label="Pickup Location"
              placeholder="Where are you starting from?"
              onSelect={(r) => setOrigin(r)}
            />
            <AddressAutocomplete
              label="Drop-off Location"
              placeholder="Where are you going?"
              onSelect={(r) => setDestination(r)}
            />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button
              onClick={handleSearch}
              isLoading={isLoading}
              disabled={!origin || !destination}
              size="lg"
            >
              Search Rides
            </Button>
            {origin && destination && (
              <p className="text-xs text-slate-400">
                Showing rides within 15 km of your route
              </p>
            )}
          </div>
        </div>

        {/* Results */}
        {hasSearched ? (
          <RideList rides={rides} isLoading={isLoading} emptyMessage="No rides found matching your route. Try adjusting your locations." />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-5xl">🗺️</span>
            <p className="mt-4 text-lg font-semibold text-slate-600 dark:text-slate-400">
              Enter your pickup and drop-off locations to find matching rides
            </p>
            <p className="mt-1 text-sm text-slate-400">
              We&apos;ll find rides that cover your route or pass through your area.
            </p>
          </div>
        )}

        {hasSearched && pagination.pages > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            {Array.from({ length: pagination.pages }, (_, i) => (
              <button
                key={i}
                onClick={() => fetchRides({ originLat: origin!.lat, originLng: origin!.lng, destLat: destination!.lat, destLng: destination!.lng, radius: 15, page: i + 1 })}
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
