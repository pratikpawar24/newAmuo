export interface User {
  _id: string;
  name: string;
  fullName?: string;
  email: string;
  role: 'user' | 'admin';
  avatar?: string;
  avatarUrl?: string;
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
  smoking?: boolean;
  smokingAllowed?: boolean;
  music?: boolean;
  musicPreference?: 'none' | 'quiet' | 'any';
  pets?: boolean;
  chatty?: boolean;
  sameGenderOnly?: boolean;
  maxDetourMinutes?: number;
  pickupFlexibilityMeters?: number;
  routePreference?: 'fastest' | 'greenest' | 'balanced';
}

export interface UserStats {
  totalRides: number;
  totalCO2Saved: number;
  totalDistance: number;
  activeDays: number;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LeaderboardEntry extends Pick<User, '_id' | 'name' | 'avatar' | 'greenScore' | 'badges'> {
  rank: number;
  stats: Pick<UserStats, 'totalRides' | 'totalCO2Saved'>;
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
