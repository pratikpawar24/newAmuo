'use client';

import RideCard from './RideCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import type { Ride } from '@/types/ride';

interface RideListProps {
  rides: Ride[];
  isLoading: boolean;
  emptyMessage?: string;
}

export default function RideList({ rides, isLoading, emptyMessage = 'No rides found.' }: RideListProps) {
  if (isLoading) return <LoadingSpinner className="py-16" />;

  if (rides.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="text-5xl">🚗</span>
        <p className="mt-4 text-lg font-semibold text-slate-600 dark:text-slate-400">{emptyMessage}</p>
        <p className="mt-1 text-sm text-slate-400">Create a ride or adjust your filters.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rides.map((ride) => (
        <RideCard key={ride._id} ride={ride} />
      ))}
    </div>
  );
}
