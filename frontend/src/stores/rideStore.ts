import { create } from 'zustand';
import api from '@/lib/api';
import type { Ride, RideFilters, CreateRidePayload } from '@/types/ride';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface RideState {
  rides: Ride[];
  currentRide: Ride | null;
  pagination: Pagination;
  isLoading: boolean;
  fetchRides: (filters?: RideFilters) => Promise<void>;
  fetchRide: (id: string) => Promise<void>;
  fetchRideById: (id: string) => Promise<Ride>;
  createRide: (payload: CreateRidePayload) => Promise<Ride>;
  bookRide: (rideId: string) => Promise<void>;
  requestToJoin: (rideId: string, pickupLocation?: { lat: number; lng: number; address: string }) => Promise<void>;
  respondToBooking: (rideId: string, passengerId: string, status: 'accepted' | 'rejected') => Promise<void>;
  updateStatus: (rideId: string, status: string) => Promise<void>;
  cancelRide: (rideId: string) => Promise<void>;
  startRide: (rideId: string) => Promise<void>;
  completeRide: (rideId: string) => Promise<void>;
  deleteRide: (rideId: string) => Promise<void>;
  clearCurrent: () => void;
}

export const useRideStore = create<RideState>((set) => ({
  rides: [],
  currentRide: null,
  pagination: { page: 1, limit: 12, total: 0, pages: 0 },
  isLoading: false,

  fetchRides: async (filters = {}) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/rides', { params: filters });
      const resp = data.data;
      set({
        rides: resp.rides,
        pagination: {
          page: resp.page || 1,
          limit: resp.limit || 12,
          total: resp.total || 0,
          pages: Math.ceil((resp.total || 0) / (resp.limit || 12)),
        },
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchRide: async (id) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/rides/${id}`);
      set({ currentRide: data.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchRideById: async (id) => {
    const { data } = await api.get(`/rides/${id}`);
    return data.data;
  },

  createRide: async (payload) => {
    const { data } = await api.post('/rides', payload);
    return data.data;
  },

  bookRide: async (rideId) => {
    await api.post(`/rides/${rideId}/book`);
  },

  requestToJoin: async (rideId, pickupLocation) => {
    await api.post(`/rides/${rideId}/book`, pickupLocation ? { pickup: { address: pickupLocation.address, coordinates: { lat: pickupLocation.lat, lng: pickupLocation.lng } } } : {});
  },

  respondToBooking: async (rideId, passengerId, status) => {
    await api.patch(`/rides/${rideId}/booking/${passengerId}`, { status });
  },

  updateStatus: async (rideId, status) => {
    await api.patch(`/rides/${rideId}/status`, { status });
  },

  cancelRide: async (rideId) => {
    await api.patch(`/rides/${rideId}/status`, { status: 'cancelled' });
  },

  startRide: async (rideId) => {
    await api.patch(`/rides/${rideId}/status`, { status: 'in_progress' });
  },

  completeRide: async (rideId) => {
    await api.patch(`/rides/${rideId}/status`, { status: 'completed' });
  },

  deleteRide: async (rideId) => {
    await api.delete(`/rides/${rideId}`);
  },

  clearCurrent: () => set({ currentRide: null }),
}));
