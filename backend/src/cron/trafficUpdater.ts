import cron from 'node-cron';
import axios from 'axios';
import { TrafficData } from '../models/TrafficData';
import { emitTrafficUpdate } from '../config/socket';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const SAMPLE_SEGMENTS = [
  { segmentId: 'seg_001', lat: 19.076, lng: 72.8777 },
  { segmentId: 'seg_002', lat: 19.082, lng: 72.882 },
  { segmentId: 'seg_003', lat: 19.070, lng: 72.870 },
  { segmentId: 'seg_004', lat: 19.090, lng: 72.890 },
  { segmentId: 'seg_005', lat: 19.065, lng: 72.860 },
  { segmentId: 'seg_006', lat: 19.095, lng: 72.895 },
  { segmentId: 'seg_007', lat: 19.075, lng: 72.885 },
  { segmentId: 'seg_008', lat: 19.060, lng: 72.870 },
  { segmentId: 'seg_009', lat: 19.085, lng: 72.875 },
  { segmentId: 'seg_010', lat: 19.078, lng: 72.865 },
];

// Every 5 minutes — fetch AI predictions & store in DB
export function startTrafficUpdater(): void {
  cron.schedule('*/5 * * * *', async () => {
    try {
      logger.debug('[CRON] Fetching traffic predictions...');

      const aiUrl = env.AI_SERVICE_URL || 'http://ai-service:8000';
      const response = await axios.post(`${aiUrl}/api/predict-traffic`, {
        segments: SAMPLE_SEGMENTS,
        timestamp: new Date().toISOString(),
      }, { timeout: 15000 });

      if (response.data?.predictions) {
        const bulkOps = response.data.predictions.map((pred: {
          segmentId: string;
          flow: number;
          speed: number;
          density: number;
          congestionLevel: string | number;
        }) => {
          // Convert string congestion level to number for MongoDB schema
          const congestionMap: Record<string, number> = { free: 0, light: 1, moderate: 2, heavy: 3, gridlock: 4 };
          const level = typeof pred.congestionLevel === 'number'
            ? pred.congestionLevel
            : congestionMap[pred.congestionLevel] ?? 2;

          return {
            insertOne: {
              document: {
                segmentId: pred.segmentId,
                timestamp: new Date(),
                flow: pred.flow,
                speed: pred.speed,
                density: pred.density,
                congestionLevel: level,
                source: 'predicted' as const,
              },
            },
          };
        });

        if (bulkOps.length > 0) {
          await TrafficData.bulkWrite(bulkOps);
          emitTrafficUpdate('global', {
            timestamp: new Date().toISOString(),
            predictions: response.data.predictions,
          });
        }

        logger.debug(`[CRON] Stored ${bulkOps.length} traffic predictions`);
      }
    } catch (error) {
      // AI service may be unavailable — generate synthetic data
      logger.warn('[CRON] AI service unavailable, generating synthetic traffic data');
      try {
        await generateSyntheticTraffic();
      } catch (synthError) {
        logger.error('[CRON] Synthetic traffic generation failed:', synthError);
      }
    }
  });

  logger.info('[CRON] Traffic updater scheduled: every 5 minutes');
}

async function generateSyntheticTraffic(): Promise<void> {
  const hour = new Date().getHours();
  const isPeak = (hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 20);
  const baseSpeed = isPeak ? 20 : 45;
  const baseDensity = isPeak ? 0.7 : 0.3;

  const bulkOps = SAMPLE_SEGMENTS.map((seg) => {
    const noise = (Math.random() - 0.5) * 10;
    const speed = Math.max(5, baseSpeed + noise);
    const density = Math.min(1, Math.max(0, baseDensity + (Math.random() - 0.5) * 0.2));
    const flow = speed * density * 50;

    // congestionLevel must be a number (0=free, 1=light, 2=moderate, 3=heavy, 4=gridlock)
    let congestionLevel = 0;
    if (density > 0.8) congestionLevel = 4;       // gridlock
    else if (density > 0.6) congestionLevel = 3;  // heavy
    else if (density > 0.4) congestionLevel = 2;  // moderate
    else if (density > 0.2) congestionLevel = 1;  // light

    return {
      insertOne: {
        document: {
          segmentId: seg.segmentId,
          timestamp: new Date(),
          flow: Math.round(flow * 100) / 100,
          speed: Math.round(speed * 100) / 100,
          density: Math.round(density * 1000) / 1000,
          congestionLevel,
          source: 'synthetic' as const,
        },
      },
    };
  });

  await TrafficData.bulkWrite(bulkOps);
  emitTrafficUpdate('global', {
    timestamp: new Date().toISOString(),
    synthetic: true,
    count: bulkOps.length,
  });
}
