'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import RideDetail from '@/components/ride/RideDetail';
import BookingModal from '@/components/ride/BookingModal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { useRides } from '@/hooks/useRides';
import type { Ride } from '@/types/ride';

export default function RideDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { fetchRideById, requestToJoin, cancelRide, startRide, completeRide } = useRides();

  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadRide = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRideById(id);
      setRide(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load ride');
    } finally {
      setLoading(false);
    }
  }, [id, fetchRideById]);

  useEffect(() => {
    // Allow viewing ride details without auth — only load the ride
    if (!authLoading) {
      loadRide();
    }
  }, [authLoading, loadRide]);

  const handleJoinRequest = async (pickupLocation?: { lat: number; lng: number; address: string }) => {
    if (!id) return;
    setActionLoading(true);
    try {
      await requestToJoin(id, pickupLocation);
      setBookingOpen(false);
      await loadRide();
    } catch {
      // handled via toast in hook
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await cancelRide(id);
      await loadRide();
    } catch {
      // handled via toast
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await startRide(id);
      await loadRide();
    } catch {
      // handled via toast
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await completeRide(id);
      await loadRide();
    } catch {
      // handled via toast
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading || loading) return <LoadingSpinner className="min-h-screen" size="lg" />;

  if (error) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="text-center">
            <p className="text-lg text-red-500 dark:text-red-400">❌ {error}</p>
            <button className="btn-primary mt-4" onClick={() => router.push('/g-ride')}>
              Back to Rides
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!ride) return null;

  const isDriver = isAuthenticated && user?._id === (typeof ride.creator === 'string' ? ride.creator : ride.creator._id);
  const isPassenger = isAuthenticated && ride.passengers?.some(
    (p) => (typeof p.userId === 'string' ? p.userId : p.userId._id) === user?._id
  );
  const canJoin =
    !isDriver &&
    !isPassenger &&
    ride.status === 'active' &&
    ride.availableSeats > 0;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {/* Back button */}
        <button
          onClick={() => router.push('/g-ride')}
          className="mb-4 flex items-center gap-1 text-sm text-slate-600 transition hover:text-emerald-600 dark:text-slate-400"
        >
          ← Back to Rides
        </button>

        {/* Ride detail card */}
        <RideDetail ride={ride} />

        {/* Action buttons */}
        <div className="mt-6 flex flex-wrap gap-3">
          {canJoin && !isAuthenticated && (
            <button
              className="btn-primary"
              onClick={() => router.push('/login')}
            >
              🔐 Login to Join Ride
            </button>
          )}

          {canJoin && isAuthenticated && (
            <button
              className="btn-primary"
              onClick={() => setBookingOpen(true)}
              disabled={actionLoading}
            >
              🚀 Request to Join
            </button>
          )}

          {isDriver && ride.status === 'active' && (
            <>
              <button
                className="btn-primary"
                onClick={handleStart}
                disabled={actionLoading}
              >
                ▶️ Start Ride
              </button>
              <button
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
                onClick={handleCancel}
                disabled={actionLoading}
              >
                ❌ Cancel Ride
              </button>
            </>
          )}

          {isDriver && ride.status === 'in_progress' && (
            <button
              className="btn-primary"
              onClick={handleComplete}
              disabled={actionLoading}
            >
              ✅ Complete Ride
            </button>
          )}

          {isPassenger && ride.status === 'active' && (
            <button
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
              onClick={handleCancel}
              disabled={actionLoading}
            >
              🚫 Leave Ride
            </button>
          )}

          {/* Chat link */}
          {ride.chatRoomId && (isDriver || isPassenger) && (
            <button
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
              onClick={() => router.push(`/chat/${ride.chatRoomId}`)}
            >
              💬 Open Chat
            </button>
          )}
        </div>
      </main>

      {/* Booking modal */}
      <BookingModal
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
        ride={ride}
        onConfirm={handleJoinRequest}
        loading={actionLoading}
      />

      <Footer />
    </div>
  );
}
