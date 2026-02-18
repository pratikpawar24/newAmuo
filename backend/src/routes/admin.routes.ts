import { Router } from 'express';
import {
  getDashboard,
  getUsers,
  getUserById,
  updateUserRole,
  banUser,
  deleteUser,
  getRides,
  forceDeleteRide,
  getSiteStats,
  analyticsRides,
  analyticsEmissions,
  analyticsPeakHours,
  analyticsUserGrowth,
  getChatLogs,
  seedDemoData,
} from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/dashboard', getDashboard);
router.get('/users', getUsers);
router.get('/users/:userId', getUserById);
router.patch('/users/:userId/role', updateUserRole);
router.patch('/users/:userId/ban', banUser);
router.delete('/users/:userId', deleteUser);
router.get('/rides', getRides);
router.delete('/rides/:rideId', forceDeleteRide);
router.get('/stats', getSiteStats);
router.get('/analytics/rides', analyticsRides);
router.get('/analytics/emissions', analyticsEmissions);
router.get('/analytics/peak-hours', analyticsPeakHours);
router.get('/analytics/user-growth', analyticsUserGrowth);
router.get('/chat-logs/:roomId', getChatLogs);
router.post('/seed', seedDemoData);

export default router;
