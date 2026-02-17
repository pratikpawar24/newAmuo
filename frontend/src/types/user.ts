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
  preferences: UserPreferences;
  stats: UserStats;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  smoking: boolean;
  music: boolean;
  pets: boolean;
  chatty: boolean;
  routePreference: 'fastest' | 'greenest' | 'balanced';
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
