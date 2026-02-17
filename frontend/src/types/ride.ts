export interface GeoPoint {
  address: string;
  coordinates: [number, number]; // [lng, lat]
}

export interface Passenger {
  user: string | { _id: string; name: string; avatar?: string };
  status: 'pending' | 'accepted' | 'rejected';
  bookedAt: string;
}

export interface VehicleInfo {
  model: string;
  color: string;
  plateNumber: string;
}

export interface RideEmissions {
  total: number;
  perPassenger: number;
  saved: number;
  treeDaysEquivalent: number;
}

export interface Ride {
  _id: string;
  driver: string | { _id: string; name: string; avatar?: string; greenScore?: number };
  origin: GeoPoint;
  destination: GeoPoint;
  waypoints?: GeoPoint[];
  departureTime: string;
  availableSeats: number;
  totalSeats?: number;
  fare: number;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  passengers: Passenger[];
  chatRoomId: string;
  chatRoom?: string;
  vehicleInfo?: VehicleInfo;
  distanceKm?: number;
  estimatedDuration?: number;
  emissions?: RideEmissions;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRidePayload {
  origin: { address: string; lat: number; lng: number };
  destination: { address: string; lat: number; lng: number };
  departureTime: string;
  availableSeats: number;
  fare: number;
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
