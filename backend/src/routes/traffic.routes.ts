import { Router } from 'express';
import { getPredictions, getCurrentTraffic, getHeatmap } from '../controllers/traffic.controller';

const router = Router();

// Public — traffic data displayed on map for all visitors
router.get('/heatmap', getHeatmap);
router.get('/predictions', getPredictions);
router.get('/:segmentId', getCurrentTraffic);

export default router;
