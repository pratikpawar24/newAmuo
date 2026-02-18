import http from 'http';
import app from './app';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { initSocket } from './config/socket';
import { startStatsAggregator } from './cron/statsAggregator';
import { startTrafficUpdater } from './cron/trafficUpdater';
import { seedDatabase } from './utils/seedData';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  try {
    // Connect to MongoDB
    await connectDatabase();
    logger.info('MongoDB connected');

    // Seed demo data if database is empty (safe — seedDatabase checks first)
    await seedDatabase();

    // Create HTTP server
    const server = http.createServer(app);

    // Initialise Socket.IO
    initSocket(server);
    logger.info('Socket.IO initialised');

    // Start cron jobs
    startStatsAggregator();
    startTrafficUpdater();

    // Start listening
    const PORT = env.PORT || 5000;
    server.listen(PORT, () => {
      logger.info(`🚀 AUMO Backend running on port ${PORT} [${env.NODE_ENV}]`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
