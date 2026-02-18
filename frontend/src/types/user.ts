export interface User {
  _id: string;
  fullName: string;
  name?: string; // alias for backward compat
  email: string;
  role: 'user' | 'admin';
  avatarUrl?: string;
  avatar?: string; // alias for backward compat
  phone?: string;
  bio?: string;
  greenScore: number;
  badges: string[];
  banned?: boolean;
  preferences: UserPreferences;
  stats: UserStats;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  maxDetourMinutes?: number;
  sameGenderOnly?: boolean;
  smokingAllowed?: boolean;
  musicPreference?: 'silent' | 'any' | 'no_preference';
  pickupFlexibilityMeters?: number;
}

export interface UserStats {
  totalRidesCreated: number;
  totalRidesBooked: number;
  totalDistanceKm: number;
  totalCO2SavedKg: number;
  sharedRidesCount: number;
  activeDaysLast30: string[];
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}

export interface LeaderboardEntry extends Pick<User, '_id' | 'fullName' | 'avatarUrl' | 'greenScore' | 'badges'> {
  rank: number;
  stats: Pick<UserStats, 'totalRidesCreated' | 'totalCO2SavedKg'>;
}

export interface Notification {
  _id: string;
  recipient: string;
  type: 'ride_request' | 'ride_accepted' | 'ride_rejected' | 'ride_cancelled' | 'ride_started' | 'ride_completed' | 'new_message' | 'badge_earned' | 'system';
  title: string;
  message: string;
  data?: {
    rideId?: string;
    chatRoomId?: string;
    senderId?: string;
    badge?: string;
  };
  read: boolean;
  createdAt: string;
  updatedAt: string;
}
