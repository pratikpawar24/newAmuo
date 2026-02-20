import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  fullName: string;
  phone: string;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  avatarUrl: string;
  role: 'user' | 'admin';
  banned: boolean;
  preferences: {
    maxDetourMinutes: number;
    sameGenderOnly: boolean;
    smokingAllowed: boolean;
    musicPreference: 'silent' | 'any' | 'no_preference';
    pickupFlexibilityMeters: number;
  };
  greenScore: number;
  badges: string[];
  stats: {
    totalRidesCreated: number;
    totalRidesBooked: number;
    totalDistanceKm: number;
    totalCO2SavedKg: number;
    sharedRidesCount: number;
    activeDaysLast30: Date[];
  };
  refreshTokens: string[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, default: '' },
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'], default: 'prefer_not_to_say' },
    avatarUrl: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    banned: { type: Boolean, default: false },
    preferences: {
      maxDetourMinutes: { type: Number, default: 15 },
      sameGenderOnly: { type: Boolean, default: false },
      smokingAllowed: { type: Boolean, default: false },
      musicPreference: { type: String, enum: ['silent', 'any', 'no_preference'], default: 'no_preference' },
      pickupFlexibilityMeters: { type: Number, default: 500 },
    },
    greenScore: { type: Number, default: 0 },
    badges: [{ type: String }],
    stats: {
      totalRidesCreated: { type: Number, default: 0 },
      totalRidesBooked: { type: Number, default: 0 },
      totalDistanceKm: { type: Number, default: 0 },
      totalCO2SavedKg: { type: Number, default: 0 },
      sharedRidesCount: { type: Number, default: 0 },
      activeDaysLast30: [{ type: Date }],
    },
    refreshTokens: [{ type: String }],
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
