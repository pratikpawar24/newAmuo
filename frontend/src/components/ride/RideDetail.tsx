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
  const driver = typeof ride.driver === 'object' ? ride.driver : null;
  const isDriver = user?._id === driver?._id;
  const isPassenger = ride.passengers.some(
    (p) => (typeof p.user === 'string' ? p.user : p.user._id) === user?._id
  );

  return (
    <div className="space-y-6">
      {/* Driver info */}
      <div className="card flex items-center gap-4">
        {driver?.avatar ? (
          <img src={driver.avatar} alt={driver.name} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-700">
            {getInitials(driver?.name || 'D')}
          </div>
        )}
        <div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{driver?.name || 'Driver'}</p>
          {driver?.greenScore !== undefined && (
            <p className="text-sm text-emerald-600">🌿 Green Score: {driver.greenScore}</p>
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
            {ride.distanceKm && <span>{formatDistance(ride.distanceKm)}</span>}
            {ride.estimatedDuration && <span> · {formatDuration(ride.estimatedDuration)}</span>}
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
          <p className="text-2xl font-bold text-primary-600">₹{ride.fare}</p>
          <p className="text-xs text-slate-500">Fare</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-accent-600">🪑 {ride.availableSeats}</p>
          <p className="text-xs text-slate-500">Seats</p>
        </div>
        {ride.emissions && (
          <>
            <div className="card text-center">
              <p className="text-2xl font-bold text-green-600">{formatCO2(ride.emissions.saved)}</p>
              <p className="text-xs text-slate-500">CO₂ Saved</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-amber-600">🌳 {ride.emissions.treeDaysEquivalent}</p>
              <p className="text-xs text-slate-500">Tree Days</p>
            </div>
          </>
        )}
      </div>

      {/* Vehicle info */}
      {ride.vehicleInfo && (
        <div className="card">
          <h3 className="mb-2 font-semibold text-slate-900 dark:text-white">Vehicle</h3>
          <div className="grid grid-cols-3 gap-2 text-sm">
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
              const pUser = typeof p.user === 'object' ? p.user : null;
              return (
                <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-700">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold">
                      {getInitials(pUser?.name || 'P')}
                    </div>
                    <span className="text-sm font-medium">{pUser?.name || 'Passenger'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status === 'accepted' ? 'bg-green-100 text-green-700' :
                      p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {p.status}
                    </span>
                    {isDriver && p.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => onAccept?.(typeof p.user === 'string' ? p.user : p.user._id)}>✓</Button>
                        <Button size="sm" variant="danger" onClick={() => onReject?.(typeof p.user === 'string' ? p.user : p.user._id)}>✗</Button>
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
        {!isDriver && !isPassenger && ride.status === 'pending' && ride.availableSeats > 0 && (
          <Button onClick={onBook} size="lg">Book this Ride</Button>
        )}
        {isDriver && ride.status === 'pending' && (
          <Button onClick={onStart} variant="primary">Start Ride</Button>
        )}
        {isDriver && ride.status === 'in_progress' && (
          <Button onClick={onComplete} variant="primary">Complete Ride</Button>
        )}
        {isDriver && ride.status === 'pending' && (
          <Button onClick={onCancel} variant="danger">Cancel Ride</Button>
        )}
      </div>
    </div>
  );
}
