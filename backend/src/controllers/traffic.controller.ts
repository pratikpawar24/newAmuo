import { Request, Response } from 'express';
import { predictTraffic } from '../services/ai.service';
import { TrafficData } from '../models/TrafficData';
import { logger } from '../utils/logger';

export async function getPredictions(req: Request, res: Response): Promise<void> {
  try {
    const { segments, timestamp } = req.query;
    let segArray: Array<{ segmentId: string; lat: number; lng: number }> = [];

    if (typeof segments === 'string') {
      try { segArray = JSON.parse(segments); } catch { segArray = []; }
    }

    const result = await predictTraffic(segArray, (timestamp as string) || new Date().toISOString());
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Get predictions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get predictions' });
  }
}

export async function getCurrentTraffic(req: Request, res: Response): Promise<void> {
  try {
    const { segmentId } = req.params;
    const data = await TrafficData.findOne({ segmentId }).sort({ timestamp: -1 }).lean();
    res.json({ success: true, data: data || null });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get traffic data' });
  }
}

export async function getHeatmap(req: Request, res: Response): Promise<void> {
  try {
    const { south, west, north, east } = req.query;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const data = await TrafficData.find({
      timestamp: { $gte: oneHourAgo },
      source: { $in: ['predicted', 'synthetic'] },
    }).sort({ timestamp: -1 }).limit(500).lean();

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get heatmap data' });
  }
}
