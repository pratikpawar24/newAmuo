'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import RideList from '@/components/ride/RideList';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useRides } from '@/hooks/useRides';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

export default function GRidePage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { rides, isLoading, pagination, fetchRides } = useRides(true);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading) return <LoadingSpinner className="min-h-screen" size="lg" />;
  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">🚗 G-Ride</h1>
            <p className="text-sm text-slate-500">Find or offer rides, save the planet</p>
          </div>
          <Link href="/g-ride/create">
            <Button size="lg">+ Create Ride</Button>
          </Link>
        </div>

        <RideList rides={rides} isLoading={isLoading} />

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
