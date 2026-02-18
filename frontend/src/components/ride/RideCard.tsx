'use client';

import Link from 'next/link';
import { formatDate, formatDistance, formatCO2, getInitials } from '@/lib/utils';
import type { Ride } from '@/types/ride';

interface RideCardProps {
  ride: Ride;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function RideCard({ ride }: RideCardProps) {
  const creator = typeof ride.creator === 'object' ? ride.creator : null;
  const routeMatch = (ride as any).routeMatch;

  return (
    <Link href={`/g-ride/${ride._id}`}>
      <div className="card group cursor-pointer transition-all hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700">
        {/* Route match badge */}
        {routeMatch && routeMatch.onRoute && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <span>✅ On your route</span>
            <span>•</span>
            <span>{(routeMatch.overlapRatio * 100).toFixed(0)}% overlap</span>
            {routeMatch.sharedDistKm > 0 && (
              <>
                <span>•</span>
                <span>{routeMatch.sharedDistKm.toFixed(1)} km shared</span>
              </>
            )}
            {routeMatch.co2SavedKg > 0 && (
              <>
                <span>•</span>
                <span className="text-green-600">🌿 {routeMatch.co2SavedKg.toFixed(2)} kg CO₂ saved</span>
              </>
            )}
          </div>
        )}
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {creator?.avatarUrl ? (
              <img src={creator.avatarUrl} alt={creator.fullName} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700 dark:bg-primary-900/30">
                {getInitials(creator?.fullName || 'D')}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{creator?.fullName || 'Driver'}</p>
              <p className="text-xs text-slate-500">{formatDate(ride.departureTime)}</p>
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[ride.status]}`}>
            {ride.status.replace('_', ' ')}
          </span>
        </div>

        {/* Route */}
        <div className="mt-4 space-y-2">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-primary-500" />
            <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-1">{ride.origin.address}</p>
          </div>
          <div className="ml-1 border-l-2 border-dashed border-slate-200 py-1 pl-3 dark:border-slate-600">
            {ride.totalDistanceKm && (
              <span className="text-xs text-slate-400">{formatDistance(ride.totalDistanceKm)}</span>
            )}
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />
            <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-1">{ride.destination.address}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>🪑 {ride.availableSeats} seats</span>
            {ride.totalDistanceKm ? (
              <span>📏 {ride.totalDistanceKm.toFixed(1)} km</span>
            ) : null}
            {ride.co2PerKm ? (
              <span className="text-green-600">🌿 {(ride.co2PerKm * (ride.totalDistanceKm || 0) / 1000).toFixed(2)} kg CO₂</span>
            ) : ride.totalCO2Saved ? (
              <span className="text-green-600">🌿 {formatCO2(ride.totalCO2Saved)} saved</span>
            ) : null}
          </div>
          <span className="text-lg font-bold text-primary-600">₹{ride.pricePerSeat}</span>
        </div>
      </div>
    </Link>
  );
}
