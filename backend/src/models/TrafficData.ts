import mongoose, { Schema, Document } from 'mongoose';

export interface ITrafficData extends Document {
  segmentId: string;
  timestamp: Date;
  flow: number;
  speed: number;
  density: number;
  congestionLevel: number;
  source: 'sensor' | 'predicted' | 'synthetic';
}

const TrafficDataSchema = new Schema<ITrafficData>({
  segmentId: { type: String, required: true, index: true },
  timestamp: { type: Date, required: true },
  flow: { type: Number, required: true },
  speed: { type: Number, required: true },
  density: { type: Number, required: true },
  congestionLevel: { type: Number, default: 0 },
  source: { type: String, enum: ['sensor', 'predicted', 'synthetic'], default: 'synthetic' },
});

// TTL index: delete after 30 days (also serves as the timestamp index)
TrafficDataSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const TrafficData = mongoose.model<ITrafficData>('TrafficData', TrafficDataSchema);
