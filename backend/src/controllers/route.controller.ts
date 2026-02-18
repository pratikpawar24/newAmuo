import { Request, Response } from 'express';
import axios from 'axios';
import { calculateRoute, getParetoRoutes, replanRoute } from '../services/ai.service';
import { env } from '../config/env';
import { haversineKm } from '../utils/haversine';
import { logger } from '../utils/logger';

/** Direct OSRM fallback when AI service is unavailable */
async function osrmFallback(originLat: number, originLng: number, destLat: number, destLng: number) {
  const osrmUrl = env.OSRM_URL || 'https://router.project-osrm.org';
  const coordStr = `${originLng},${originLat};${destLng},${destLat}`;
  const url = `${osrmUrl}/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=true`;
  const { data } = await axios.get(url, { timeout: 15000 });
  if (data?.routes?.[0]) {
    const route = data.routes[0];
    const polyline = route.geometry?.coordinates?.map((c: number[]) => [c[1], c[0]]) || [];
    const distKm = route.distance / 1000;
    const durMin = route.duration / 60;
    const avgSpeed = distKm / (durMin / 60 || 1);
    const co2Grams = distKm * (avgSpeed < 20 ? 220 : avgSpeed < 50 ? 170 : avgSpeed < 80 ? 150 : 180);
    return {
      primary: { polyline, distanceKm: Math.round(distKm * 100) / 100, durationMin: Math.round(durMin * 10) / 10, co2Grams: Math.round(co2Grams), cost: 0 },
      alternative: null,
      trafficOverlay: [],
    };
  }
  return null;
}

export async function getRoute(req: Request, res: Response): Promise<void> {
  try {
    const { origin, destination, weights, departureTime } = req.body;

    if (!origin || !destination || !origin.lat || !origin.lng || !destination.lat || !destination.lng) {
      res.status(400).json({ success: false, error: 'Origin and destination with lat/lng required' });
      return;
    }

    const routeWeights = {
      alpha: weights?.alpha ?? 0.5,
      beta: weights?.beta ?? 0.3,
      gamma: weights?.gamma ?? 0.2,
    };

    // Normalise weights to sum to 1
    const sum = routeWeights.alpha + routeWeights.beta + routeWeights.gamma;
    if (sum > 0) {
      routeWeights.alpha /= sum;
      routeWeights.beta /= sum;
      routeWeights.gamma /= sum;
    }

    const result = await calculateRoute(
      { lat: origin.lat, lng: origin.lng },
      { lat: destination.lat, lng: destination.lng },
      departureTime || new Date().toISOString(),
      routeWeights,
    );

    // If AI service returned a valid result, use it
    if (result) {
      res.json({ success: true, data: result });
      return;
    }

    // Fallback to OSRM directly when AI is unavailable
    logger.warn('AI route returned null, falling back to OSRM');
    const fallback = await osrmFallback(origin.lat, origin.lng, destination.lat, destination.lng);
    if (fallback) {
      res.json({ success: true, data: fallback });
      return;
    }

    // Absolute fallback — straight line
    const dist = haversineKm(origin.lat, origin.lng, destination.lat, destination.lng);
    res.json({
      success: true,
      data: {
        primary: {
          polyline: [[origin.lat, origin.lng], [destination.lat, destination.lng]],
          distanceKm: Math.round(dist * 100) / 100,
          durationMin: Math.round(dist / 30 * 60 * 10) / 10,
          co2Grams: Math.round(dist * 170),
          cost: 0,
        },
        alternative: null,
        trafficOverlay: [],
      },
    });
  } catch (error) {
    logger.error('Route calculation error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate route' });
  }
}

export async function getMultiRoute(req: Request, res: Response): Promise<void> {
  try {
    const { origin, destination, departureTime: depTime } = req.body;

    if (!origin || !destination) {
      res.status(400).json({ success: false, error: 'Origin and destination required' });
      return;
    }

    const presets = [
      { name: 'fastest', alpha: 0.8, beta: 0.1, gamma: 0.1 },
      { name: 'greenest', alpha: 0.2, beta: 0.6, gamma: 0.2 },
      { name: 'balanced', alpha: 0.4, beta: 0.3, gamma: 0.3 },
      { name: 'shortest', alpha: 0.1, beta: 0.1, gamma: 0.8 },
    ];

    const routes = await Promise.all(
      presets.map(async (preset) => {
        try {
          const result = await calculateRoute(
            { lat: origin.lat, lng: origin.lng },
            { lat: destination.lat, lng: destination.lng },
            depTime || new Date().toISOString(),
            { alpha: preset.alpha, beta: preset.beta, gamma: preset.gamma },
          );
          if (result) return { name: preset.name, ...result };
          // Fallback to OSRM
          const fb = await osrmFallback(origin.lat, origin.lng, destination.lat, destination.lng);
          return fb ? { name: preset.name, ...fb } : { name: preset.name, error: 'Route unavailable' };
        } catch {
          return { name: preset.name, error: 'Route unavailable' };
        }
      }),
    );

    res.json({ success: true, data: routes });
  } catch (error) {
    logger.error('Multi-route error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate routes' });
  }
}

export async function ecoCompare(req: Request, res: Response): Promise<void> {
  try {
    const { origin, destination, departureTime } = req.body;

    if (!origin || !destination) {
      res.status(400).json({ success: false, error: 'Origin and destination required' });
      return;
    }

    const [standardRoute, ecoRoute] = await Promise.all([
      calculateRoute(
        { lat: origin.lat, lng: origin.lng },
        { lat: destination.lat, lng: destination.lng },
        departureTime || new Date().toISOString(),
        { alpha: 0.9, beta: 0.05, gamma: 0.05 }, // Standard: prioritize time
      ),
      calculateRoute(
        { lat: origin.lat, lng: origin.lng },
        { lat: destination.lat, lng: destination.lng },
        departureTime || new Date().toISOString(),
        { alpha: 0.2, beta: 0.6, gamma: 0.2 }, // Eco: prioritize emissions
      ),
    ]);

    const comparison = {
      standard: standardRoute,
      eco: ecoRoute,
      savings: {
        timeDifferenceMin: (ecoRoute?.primary?.durationMin || 0) - (standardRoute?.primary?.durationMin || 0),
        co2SavedGrams: (standardRoute?.primary?.co2Grams || 0) - (ecoRoute?.primary?.co2Grams || 0),
        distanceDifferenceKm: (ecoRoute?.primary?.distanceKm || 0) - (standardRoute?.primary?.distanceKm || 0),
        percentageCO2Saved: standardRoute?.primary?.co2Grams
          ? (((standardRoute.primary.co2Grams - (ecoRoute?.primary?.co2Grams || 0)) / standardRoute.primary.co2Grams) * 100).toFixed(1)
          : '0',
      },
    };

    res.json({ success: true, data: comparison });
  } catch (error) {
    logger.error('Eco-compare error:', error);
    res.status(500).json({ success: false, error: 'Failed to compare routes' });
  }
}

// ── AUMO-ORION Pareto & Re-plan Controllers ─────────────────────────

export async function getParetoRoutesHandler(req: Request, res: Response): Promise<void> {
  try {
    const { origin, destination, departureTime } = req.body;

    if (!origin || !destination || !origin.lat || !origin.lng || !destination.lat || !destination.lng) {
      res.status(400).json({ success: false, error: 'Origin and destination with lat/lng required' });
      return;
    }

    const result = await getParetoRoutes(
      { lat: origin.lat, lng: origin.lng },
      { lat: destination.lat, lng: destination.lng },
      departureTime || new Date().toISOString(),
    );

    if (!result) {
      res.status(503).json({ success: false, error: 'AI service unavailable' });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Pareto routes error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate Pareto routes' });
  }
}

export async function replanRouteHandler(req: Request, res: Response): Promise<void> {
  try {
    const {
      rideId,
      currentPosition,
      destination,
      departureTime,
      weights,
      trafficChangePct,
      isOffRoute,
      incidentOnRoute,
    } = req.body;

    if (!rideId || !currentPosition || !destination) {
      res.status(400).json({ success: false, error: 'rideId, currentPosition, and destination required' });
      return;
    }

    const routeWeights = {
      alpha: weights?.alpha ?? 0.5,
      beta: weights?.beta ?? 0.3,
      gamma: weights?.gamma ?? 0.2,
    };

    const result = await replanRoute(
      rideId,
      { lat: currentPosition.lat, lng: currentPosition.lng },
      { lat: destination.lat, lng: destination.lng },
      departureTime || new Date().toISOString(),
      routeWeights,
      trafficChangePct || 0,
      isOffRoute || false,
      incidentOnRoute || false,
    );

    if (!result) {
      res.status(503).json({ success: false, error: 'AI service unavailable' });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Replan route error:', error);
    res.status(500).json({ success: false, error: 'Failed to re-plan route' });
  }
}
