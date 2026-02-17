import mongoose, { Schema, Document } from 'mongoose';

export interface ISiteStats extends Document {
  date: Date;
  totalVisitors: number;
  totalUsers: number;
  totalRidesCreated: number;
  totalRidesCompleted: number;
  totalCO2SavedKg: number;
  peakHourDistribution: number[];
}

const SiteStatsSchema = new Schema<ISiteStats>({
  date: { type: Date, required: true, unique: true, index: true },
  totalVisitors: { type: Number, default: 0 },
  totalUsers: { type: Number, default: 0 },
  totalRidesCreated: { type: Number, default: 0 },
  totalRidesCompleted: { type: Number, default: 0 },
  totalCO2SavedKg: { type: Number, default: 0 },
  peakHourDistribution: { type: [Number], default: () => new Array(24).fill(0) },
});

export const SiteStats = mongoose.model<ISiteStats>('SiteStats', SiteStatsSchema);
