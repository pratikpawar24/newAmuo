'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import AddressAutocomplete from '@/components/map/AddressAutocomplete';
import { useRideStore } from '@/stores/rideStore';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useState } from 'react';

const schema = z.object({
  departureTime: z.string().min(1, 'Required'),
  totalSeats: z.number().min(1).max(6),
  pricePerSeat: z.number().min(1, 'Price must be > 0'),
  vehicleModel: z.string().min(1, 'Required'),
  vehicleColor: z.string().min(1, 'Required'),
  plateNumber: z.string().min(1, 'Required'),
  fuelType: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function CreateRideForm() {
  const router = useRouter();
  const createRide = useRideStore((s) => s.createRide);
  const [origin, setOrigin] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [destination, setDestination] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { totalSeats: 2, pricePerSeat: 50 },
  });

  const onSubmit = async (formData: FormData) => {
    if (!origin) { toast.error('Select origin'); return; }
    if (!destination) { toast.error('Select destination'); return; }
    setIsSubmitting(true);
    try {
      const ride = await createRide({
        origin: { address: origin.address, coordinates: { lat: origin.lat, lng: origin.lng } },
        destination: { address: destination.address, coordinates: { lat: destination.lat, lng: destination.lng } },
        departureTime: new Date(formData.departureTime).toISOString(),
        totalSeats: formData.totalSeats,
        pricePerSeat: formData.pricePerSeat,
        vehicleInfo: {
          model: formData.vehicleModel,
          color: formData.vehicleColor,
          plateNumber: formData.plateNumber,
          fuelType: (formData.fuelType as 'petrol' | 'diesel' | 'electric' | 'hybrid') || 'petrol',
        },
      });
      toast.success('Ride created!');
      router.push(`/g-ride/${ride._id}`);
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create ride';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <AddressAutocomplete
          label="Origin"
          placeholder="Where are you starting from?"
          onSelect={(r) => setOrigin({ address: r.display_name.split(',').slice(0, 2).join(', '), lat: r.lat, lng: r.lng })}
        />
        <AddressAutocomplete
          label="Destination"
          placeholder="Where are you going?"
          onSelect={(r) => setDestination({ address: r.display_name.split(',').slice(0, 2).join(', '), lat: r.lat, lng: r.lng })}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Input
          type="datetime-local"
          label="Departure Time"
          error={errors.departureTime?.message}
          {...register('departureTime')}
        />
        <Input
          type="number"
          label="Total Seats"
          error={errors.totalSeats?.message}
          {...register('totalSeats', { valueAsNumber: true })}
        />
        <Input
          type="number"
          label="Price per Seat (₹)"
          error={errors.pricePerSeat?.message}
          {...register('pricePerSeat', { valueAsNumber: true })}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Input
          label="Vehicle Model"
          placeholder="e.g. Maruti Swift"
          error={errors.vehicleModel?.message}
          {...register('vehicleModel')}
        />
        <Input
          label="Color"
          placeholder="e.g. White"
          error={errors.vehicleColor?.message}
          {...register('vehicleColor')}
        />
        <Input
          label="Plate Number"
          placeholder="e.g. MH-01-AB-1234"
          error={errors.plateNumber?.message}
          {...register('plateNumber')}
        />
      </div>

      <Button type="submit" isLoading={isSubmitting} size="lg" className="w-full">
        Create Ride
      </Button>
    </form>
  );
}
