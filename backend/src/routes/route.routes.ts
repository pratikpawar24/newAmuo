import { Router } from 'express';
import { getRoute, getMultiRoute, ecoCompare, getParetoRoutesHandler, replanRouteHandler } from '../controllers/route.controller';

const router = Router();

// Route calculation is public (maps/routing available without login)
router.post('/calculate', getRoute);
router.post('/eco-compare', ecoCompare);
router.post('/multi', getMultiRoute);

// AUMO-ORION endpoints
router.post('/pareto', getParetoRoutesHandler);
router.post('/replan', replanRouteHandler);

export default router;
