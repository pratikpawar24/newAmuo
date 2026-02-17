import cron from 'node-cron';
import { aggregateDailyStats } from '../services/stats.service';
import { logger } from '../utils/logger';

// Run daily at 00:05 UTC
export function startStatsAggregator(): void {
  cron.schedule('5 0 * * *', async () => {
    try {
      logger.info('[CRON] Starting daily stats aggregation...');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      await aggregateDailyStats();
      logger.info('[CRON] Daily stats aggregation completed.');
    } catch (error) {
      logger.error('[CRON] Stats aggregation failed:', error);
    }
  });

  logger.info('[CRON] Stats aggregator scheduled: daily at 00:05 UTC');
}
