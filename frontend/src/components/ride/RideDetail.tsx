'use client';

import { formatDate, formatDistance, formatCO2, formatDuration, getInitials } from '@/lib/utils';
import type { Ride } from '@/types/ride';
import Button from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

interface RideDetailProps {
  ride: Ride;
  onBook?: () => void;
  onAccept?: (passengerId: string) => void;
  onReject?: (passengerId: string) => void;
  onStart?: () => void;
  onComplete?: () => void;
  onCancel?: () => void;
}

export default function RideDetail({ ride, onBook, onAccept, onReject, onStart, onComplete, onCancel }: RideDetailProps) {
  const { user } = useAuth();
  const creator = typeof ride.creator === 'object' ? ride.creator : null;
  const isCreator = user?._id === (creator?._id || ride.creator);
  const isPassenger = ride.passengers.some(
    (p) => (typeof p.userId === 'string' ? p.userId : p.userId._id) === user?._id
  );

  return (
    <div className="space-y-6">
      {/* Driver info */}
      <div className="card flex items-center gap-4">
        {creator?.avatarUrl ? (
          <img src={creator.avatarUrl} alt={creator.fullName} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-700">
            {getInitials(creator?.fullName || 'D')}
          </div>
        )}
        <div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{creator?.fullName || 'Driver'}</p>
          {creator?.greenScore !== undefined && (
            <p className="text-sm text-emerald-600">🌿 Green Score: {creator.greenScore}</p>
          )}
        </div>
      </div>

      {/* Route */}
      <div className="card">
        <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">Route</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="mt-1 h-3 w-3 rounded-full bg-primary-500" />
            <div>
              <p className="text-sm font-medium">{ride.origin.address}</p>
              <p className="text-xs text-slate-500">{formatDate(ride.departureTime)}</p>
            </div>
          </div>
          <div className="ml-1.5 border-l-2 border-dashed border-slate-300 py-2 pl-5 text-xs text-slate-500 dark:border-slate-600">
            {ride.totalDistanceKm && <span>{formatDistance(ride.totalDistanceKm)}</span>}
            {ride.estimatedDurationMin && <span> · {formatDuration(ride.estimatedDurationMin)}</span>}
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-1 h-3 w-3 rounded-full bg-red-500" />
            <p className="text-sm font-medium">{ride.destination.address}</p>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-primary-600">₹{ride.pricePerSeat}</p>
          <p className="text-xs text-slate-500">Per Seat</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-accent-600">🪑 {ride.availableSeats}</p>
          <p className="text-xs text-slate-500">Seats</p>
        </div>
        {ride.totalCO2Saved != null && (
          <div className="card text-center">
            <p className="text-2xl font-bold text-green-600">{formatCO2(ride.totalCO2Saved)}</p>
            <p className="text-xs text-slate-500">CO₂ Saved</p>
          </div>
        )}
        {ride.totalDistanceKm != null && (
          <div className="card text-center">
            <p className="text-2xl font-bold text-amber-600">{formatDistance(ride.totalDistanceKm)}</p>
            <p className="text-xs text-slate-500">Distance</p>
          </div>
        )}
      </div>

      {/* Vehicle info */}
      {ride.vehicleInfo && (
        <div className="card">
          <h3 className="mb-2 font-semibold text-slate-900 dark:text-white">Vehicle</h3>
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            {ride.vehicleInfo.make && <div><span className="text-slate-500">Make:</span> {ride.vehicleInfo.make}</div>}
            <div><span className="text-slate-500">Model:</span> {ride.vehicleInfo.model}</div>
            <div><span className="text-slate-500">Color:</span> {ride.vehicleInfo.color}</div>
            <div><span className="text-slate-500">Plate:</span> {ride.vehicleInfo.plateNumber}</div>
          </div>
        </div>
      )}

      {/* Passengers */}
      {ride.passengers.length > 0 && (
        <div className="card">
          <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">Passengers ({ride.passengers.length})</h3>
          <div className="space-y-2">
            {ride.passengers.map((p, i) => {
              const pUser = typeof p.userId === 'object' ? p.userId : null;
              const pId = typeof p.userId === 'string' ? p.userId : p.userId._id;
              return (
                <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-700">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold">
                      {getInitials(pUser?.fullName || 'P')}
                    </div>
                    <span className="text-sm font-medium">{pUser?.fullName || 'Passenger'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status === 'accepted' ? 'bg-green-100 text-green-700' :
                      p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {p.status}
                    </span>
                    {isCreator && p.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => onAccept?.(pId)}>✓</Button>
                        <Button size="sm" variant="danger" onClick={() => onReject?.(pId)}>✗</Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {!isCreator && !isPassenger && ride.status === 'active' && ride.availableSeats > 0 && (
          <Button onClick={onBook} size="lg">Book this Ride</Button>
        )}
        {isCreator && ride.status === 'active' && (
          <Button onClick={onStart} variant="primary">Start Ride</Button>
        )}
        {isCreator && ride.status === 'in_progress' && (
          <Button onClick={onComplete} variant="primary">Complete Ride</Button>
        )}
        {isCreator && ride.status === 'active' && (
          <Button onClick={onCancel} variant="danger">Cancel Ride</Button>
        )}
      </div>
    </div>
  );
}
