import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const aiClient = axios.create({
  baseURL: env.AI_SERVICE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

export async function predictTraffic(segments: Array<{ segmentId: string; lat: number; lng: number }>, timestamp: string) {
  try {
    const { data } = await aiClient.post('/api/predict-traffic', { segments, timestamp });
    return data;
  } catch (error: unknown) {
    logger.error('AI predict-traffic error:', error instanceof Error ? error.message : error);
    return { predictions: [] };
  }
}

export async function calculateRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  departureTime: string,
  weights = { alpha: 0.5, beta: 0.35, gamma: 0.15 },
  avoidTolls = false
) {
  try {
    const { data } = await aiClient.post('/api/route', { origin, destination, departureTime, weights, avoidTolls });
    return data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      logger.error(`AI route error (${error.response.status}):`, error.response.data?.detail || error.message);
    } else {
      logger.error('AI route error:', error instanceof Error ? error.message : error);
    }
    return null;
  }
}

export async function matchRides(
  riderOrigin: { lat: number; lng: number },
  riderDestination: { lat: number; lng: number },
  departureTime: string,
  preferences: Record<string, unknown>,
  availableRides: Array<Record<string, unknown>>
) {
  try {
    const { data } = await aiClient.post('/api/match', { riderOrigin, riderDestination, departureTime, preferences, availableRides });
    return data;
  } catch (error: unknown) {
    logger.error('AI match error:', error instanceof Error ? error.message : error);
    return { matches: [] };
  }
}

export async function calculateEmissions(
  segments: Array<{ distanceKm: number; avgSpeedKmh: number }>,
  passengers: number,
  fuelType: string
) {
  try {
    const { data } = await aiClient.post('/api/emissions', { segments, passengers, fuelType });
    return data;
  } catch (error: unknown) {
    logger.error('AI emissions error:', error instanceof Error ? error.message : error);
    return { totalCO2g: 0, perPassengerCO2g: 0, co2SavedVsSolo: 0, equivalentTreeDays: 0 };
  }
}

export async function healthCheck() {
  try {
    const { data } = await aiClient.get('/api/health');
    return data;
  } catch (error: unknown) {
    logger.error('AI health check error:', error instanceof Error ? error.message : error);
    return { status: 'unhealthy' };
  }
}
