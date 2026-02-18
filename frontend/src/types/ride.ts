export interface GeoPoint {
  address: string;
  coordinates: { lat: number; lng: number };
  placeId?: string;
}

export interface Passenger {
  userId: string | { _id: string; fullName: string; avatarUrl?: string };
  pickup?: { address: string; coordinates: { lat: number; lng: number } };
  dropoff?: { address: string; coordinates: { lat: number; lng: number } };
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
  co2SavedKg?: number;
  fare?: number;
  bookedAt: string;
}

export interface VehicleInfo {
  make?: string;
  model: string;
  color: string;
  plateNumber: string;
  fuelType?: 'petrol' | 'diesel' | 'electric' | 'hybrid';
}

export interface Ride {
  _id: string;
  creator: string | { _id: string; fullName: string; avatarUrl?: string; greenScore?: number; badges?: string[] };
  origin: GeoPoint;
  destination: GeoPoint;
  waypoints?: Array<{ lat: number; lng: number; type: 'pickup' | 'dropoff' }>;
  routePolyline?: number[][];
  departureTime: string;
  estimatedArrival?: string;
  totalDistanceKm?: number;
  estimatedDurationMin?: number;
  pricePerSeat: number;
  currency?: string;
  totalSeats?: number;
  availableSeats: number;
  passengers: Passenger[];
  status: 'active' | 'in_progress' | 'completed' | 'cancelled';
  vehicleInfo?: VehicleInfo;
  co2PerKm?: number;
  totalCO2Saved?: number;
  matchScore?: number;
  chatRoomId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRidePayload {
  origin: { address: string; coordinates: { lat: number; lng: number } };
  destination: { address: string; coordinates: { lat: number; lng: number } };
  departureTime: string;
  totalSeats?: number;
  pricePerSeat?: number;
  vehicleInfo?: VehicleInfo;
}

export interface RideFilters {
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
  radius?: number;
  status?: string;
  minSeats?: number;
  page?: number;
  limit?: number;
}
