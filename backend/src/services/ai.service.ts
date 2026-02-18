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
    logger.error('AI route error:', error instanceof Error ? error.message : error);
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

// ── AUMO-ORION Advanced AI Service Functions ──────────────────────────────────

export async function getParetoRoutes(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  departureTime: string
) {
  try {
    const { data } = await aiClient.post('/api/route/pareto', {
      origin,
      destination,
      departureTime,
    });
    return data;
  } catch (error: unknown) {
    logger.error('AI pareto routes error:', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function replanRoute(
  rideId: string,
  currentPosition: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  departureTime: string,
  weights = { alpha: 0.5, beta: 0.35, gamma: 0.15 },
  trafficChangePct = 0.0,
  isOffRoute = false,
  incidentOnRoute = false
) {
  try {
    const { data } = await aiClient.post('/api/route/replan', {
      rideId,
      currentPosition,
      destination,
      departureTime,
      weights,
      trafficChangePct,
      isOffRoute,
      incidentOnRoute,
    });
    return data;
  } catch (error: unknown) {
    logger.error('AI replan error:', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function predictTrafficAdvanced(
  segments: Array<{ segmentId: string; lat: number; lng: number }>,
  timestamp: string,
  useStGat = true
) {
  try {
    const { data } = await aiClient.post('/api/predict-traffic-advanced', {
      segments,
      timestamp,
      useStGat,
    });
    return data;
  } catch (error: unknown) {
    logger.error('AI advanced predict error:', error instanceof Error ? error.message : error);
    return { predictions: [], model: 'fallback' };
  }
}
