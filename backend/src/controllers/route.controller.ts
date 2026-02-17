import { Request, Response } from 'express';
import { calculateRoute } from '../services/ai.service';
import { logger } from '../utils/logger';

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

    res.json({ success: true, data: result });
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
          return { name: preset.name, ...result };
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
