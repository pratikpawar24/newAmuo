import { Router } from 'express';
import { getRoute, getMultiRoute } from '../controllers/route.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/calculate', getRoute);
router.post('/multi', getMultiRoute);

export default router;
