import { Router } from 'express';
import { getPredictions, getCurrentTraffic, getHeatmap } from '../controllers/traffic.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/predictions', getPredictions);
router.get('/heatmap', getHeatmap);
router.get('/:segmentId', getCurrentTraffic);

export default router;
