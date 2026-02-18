import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  changePassword,
  getMyStats,
  getPublicProfile,
  getLeaderboard,
  getNotifications,
  markNotificationRead,
  getUnreadCount,
  markAllNotificationsRead,
} from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/leaderboard', authenticate, getLeaderboard);
router.get('/profile', authenticate, getProfile);
router.patch('/profile', authenticate, updateProfile);
router.post('/profile/avatar', authenticate, uploadAvatar);
router.patch('/password', authenticate, changePassword);
router.get('/stats', authenticate, getMyStats);
router.get('/notifications', authenticate, getNotifications);
router.get('/notifications/unread-count', authenticate, getUnreadCount);
router.patch('/notifications/read-all', authenticate, markAllNotificationsRead);
router.patch('/notifications/:notificationId/read', authenticate, markNotificationRead);
router.get('/:userId', authenticate, getPublicProfile);

export default router;
