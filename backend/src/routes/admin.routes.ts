import { Router } from 'express';
import {
  getDashboard,
  getUsers,
  getUserById,
  updateUserRole,
  deleteUser,
  getRides,
  getSiteStats,
} from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/dashboard', getDashboard);
router.get('/users', getUsers);
router.get('/users/:userId', getUserById);
router.patch('/users/:userId/role', updateUserRole);
router.delete('/users/:userId', deleteUser);
router.get('/rides', getRides);
router.get('/stats', getSiteStats);

export default router;
