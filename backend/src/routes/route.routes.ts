import { Router } from 'express';
import { getRoute, getMultiRoute, ecoCompare } from '../controllers/route.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/calculate', getRoute);
router.post('/eco-compare', ecoCompare);
router.post('/multi', getMultiRoute);

export default router;
