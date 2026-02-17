import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  changePassword,
  getMyStats,
  getPublicProfile,
  getLeaderboard,
} from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/leaderboard', authenticate, getLeaderboard);
router.get('/profile', authenticate, getProfile);
router.patch('/profile', authenticate, updateProfile);
router.patch('/password', authenticate, changePassword);
router.get('/stats', authenticate, getMyStats);
router.get('/:userId', authenticate, getPublicProfile);

export default router;
