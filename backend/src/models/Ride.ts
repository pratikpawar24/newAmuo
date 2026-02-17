import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPassenger {
  userId: Types.ObjectId;
  pickup: { address: string; coordinates: { lat: number; lng: number } };
  dropoff: { address: string; coordinates: { lat: number; lng: number } };
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
  co2SavedKg: number;
  fare: number;
  bookedAt: Date;
}

export interface IRide extends Document {
  creator: Types.ObjectId;
  origin: { address: string; coordinates: { lat: number; lng: number }; placeId: string };
  destination: { address: string; coordinates: { lat: number; lng: number }; placeId: string };
  waypoints: Array<{ lat: number; lng: number; type: 'pickup' | 'dropoff'; userId: Types.ObjectId }>;
  routePolyline: number[][];
  departureTime: Date;
  estimatedArrival: Date;
  totalDistanceKm: number;
  estimatedDurationMin: number;
  pricePerSeat: number;
  currency: string;
  totalSeats: number;
  availableSeats: number;
  passengers: IPassenger[];
  status: 'active' | 'in_progress' | 'completed' | 'cancelled';
  vehicleInfo: {
    make: string;
    model: string;
    color: string;
    plateNumber: string;
    fuelType: 'petrol' | 'diesel' | 'electric' | 'hybrid';
  };
  co2PerKm: number;
  totalCO2Saved: number;
  matchScore: number;
  chatRoomId: string;
  createdAt: Date;
  updatedAt: Date;
}

const PassengerSchema = new Schema<IPassenger>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  pickup: {
    address: { type: String, default: '' },
    coordinates: { lat: { type: Number, required: true }, lng: { type: Number, required: true } },
  },
  dropoff: {
    address: { type: String, default: '' },
    coordinates: { lat: { type: Number, required: true }, lng: { type: Number, required: true } },
  },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'], default: 'pending' },
  co2SavedKg: { type: Number, default: 0 },
  fare: { type: Number, default: 0 },
  bookedAt: { type: Date, default: Date.now },
});

const RideSchema = new Schema<IRide>(
  {
    creator: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    origin: {
      address: { type: String, default: '' },
      coordinates: { lat: { type: Number, required: true }, lng: { type: Number, required: true } },
      placeId: { type: String, default: '' },
    },
    destination: {
      address: { type: String, default: '' },
      coordinates: { lat: { type: Number, required: true }, lng: { type: Number, required: true } },
      placeId: { type: String, default: '' },
    },
    waypoints: [{
      lat: Number,
      lng: Number,
      type: { type: String, enum: ['pickup', 'dropoff'] },
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
    }],
    routePolyline: [[Number]],
    departureTime: { type: Date, required: true, index: true },
    estimatedArrival: { type: Date },
    totalDistanceKm: { type: Number, default: 0 },
    estimatedDurationMin: { type: Number, default: 0 },
    pricePerSeat: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    totalSeats: { type: Number, default: 4 },
    availableSeats: { type: Number, default: 4 },
    passengers: [PassengerSchema],
    status: { type: String, enum: ['active', 'in_progress', 'completed', 'cancelled'], default: 'active' },
    vehicleInfo: {
      make: { type: String, default: '' },
      model: { type: String, default: '' },
      color: { type: String, default: '' },
      plateNumber: { type: String, default: '' },
      fuelType: { type: String, enum: ['petrol', 'diesel', 'electric', 'hybrid'], default: 'petrol' },
    },
    co2PerKm: { type: Number, default: 0 },
    totalCO2Saved: { type: Number, default: 0 },
    matchScore: { type: Number, default: 0 },
    chatRoomId: { type: String, default: '' },
  },
  { timestamps: true }
);

RideSchema.index({ departureTime: 1, 'origin.coordinates.lat': 1, 'origin.coordinates.lng': 1 });
RideSchema.index({ 'origin.address': 'text', 'destination.address': 'text' });

export const Ride = mongoose.model<IRide>('Ride', RideSchema);
