'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import type { Ride } from '@/types/ride';

interface BookingModalProps {
  rideId?: string;
  fare?: number;
  ride?: Ride;
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (pickupLocation?: { lat: number; lng: number; address: string }) => Promise<void>;
  loading?: boolean;
}

export default function BookingModal({ rideId, fare, ride, isOpen, onClose, onConfirm, loading }: BookingModalProps) {
  const [isBooking, setIsBooking] = useState(false);

  const displayFare = fare ?? ride?.pricePerSeat ?? 0;

  const handleBook = async () => {
    setIsBooking(true);
    try {
      if (onConfirm) {
        await onConfirm();
      }
      onClose();
    } catch {
      // handled by parent
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirm Booking" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          You are about to request a booking for this ride. The driver will be notified and can accept or reject your request.
        </p>
        <div className="rounded-xl bg-primary-50 p-4 text-center dark:bg-primary-900/20">
          <p className="text-sm text-slate-500">Fare</p>
          <p className="text-3xl font-bold text-primary-600">₹{displayFare}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleBook} isLoading={isBooking || loading} className="flex-1">
            Confirm Booking
          </Button>
        </div>
      </div>
    </Modal>
  );
}
