import { Request, Response } from 'express';
import { User } from '../models/User';
import { Ride } from '../models/Ride';
import { Message } from '../models/Message';
import { SiteStats } from '../models/SiteStats';
import { TrafficData } from '../models/TrafficData';
import { Notification } from '../models/Notification';
import { seedDatabase } from '../utils/seedData';
import { logger } from '../utils/logger';

export async function getDashboard(req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersThisMonth,
      totalRides,
      activeRides,
      completedRides,
      recentStats,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Ride.countDocuments(),
      Ride.countDocuments({ status: { $in: ['active', 'in_progress'] } }),
      Ride.countDocuments({ status: 'completed' }),
      SiteStats.find().sort({ date: -1 }).limit(30).lean(),
    ]);

    const totalCO2Saved = recentStats.reduce((sum, s) => sum + ((s as any).totalCO2SavedKg || 0), 0);

    res.json({
      success: true,
      data: {
        users: { total: totalUsers, newThisMonth: newUsersThisMonth },
        rides: { total: totalRides, active: activeRides, completed: completedRides },
        environment: { totalCO2Saved },
        dailyStats: recentStats.reverse(),
      },
    });
  } catch (error) {
    logger.error('Admin dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to load dashboard' });
  }
}

export async function getUsers(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    const role = req.query.role as string;

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (role && ['user', 'admin'].includes(role)) filter.role = role;

    const [users, total] = await Promise.all([
      User.find(filter).select('-passwordHash -refreshTokens').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get users' });
  }
}

export async function getUserById(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.params.userId).select('-passwordHash -refreshTokens').lean();
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    const ridesCreated = await Ride.countDocuments({ creator: user._id });
    const ridesBooked = await Ride.countDocuments({ 'passengers.userId': user._id, 'passengers.status': 'accepted' });

    res.json({ success: true, data: { ...user, ridesCreated, ridesBooked } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
}

export async function updateUserRole(req: Request, res: Response): Promise<void> {
  try {
    const { role } = req.body;
    if (!role || !['user', 'admin'].includes(role)) {
      res.status(400).json({ success: false, error: 'Invalid role' });
      return;
    }
    if (req.params.userId === req.user!.userId) {
      res.status(400).json({ success: false, error: 'Cannot change your own role' });
      return;
    }
    const user = await User.findByIdAndUpdate(req.params.userId, { role }, { new: true }).select('-passwordHash -refreshTokens');
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    res.json({ success: true, data: user, message: `Role updated to ${role}` });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update role' });
  }
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    if (req.params.userId === req.user!.userId) {
      res.status(400).json({ success: false, error: 'Cannot delete yourself' });
      return;
    }
    const user = await User.findByIdAndDelete(req.params.userId);
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    await Promise.all([
      Ride.deleteMany({ creator: user._id }),
      Notification.deleteMany({ userId: user._id }),
    ]);

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
}

export async function getRides(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const status = req.query.status as string;

    const filter: Record<string, unknown> = {};
    if (status && ['active', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      filter.status = status;
    }

    const [rides, total] = await Promise.all([
      Ride.find(filter).populate('creator', 'fullName email avatarUrl').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Ride.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        rides,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get rides' });
  }
}

export async function getSiteStats(req: Request, res: Response): Promise<void> {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 30, 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const stats = await SiteStats.find({ date: { $gte: since } }).sort({ date: 1 }).lean();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
}

/* ── Ban / Unban User ───────────────────────────────────── */
export async function banUser(req: Request, res: Response): Promise<void> {
  try {
    const { ban } = req.body; // boolean
    if (req.params.userId === req.user!.userId) {
      res.status(400).json({ success: false, error: 'Cannot ban yourself' });
      return;
    }
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { banned: !!ban },
      { new: true }
    ).select('-passwordHash -refreshTokens');
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    res.json({ success: true, data: user, message: ban ? 'User banned' : 'User unbanned' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update ban status' });
  }
}

/* ── Force Delete Ride ──────────────────────────────────── */
export async function forceDeleteRide(req: Request, res: Response): Promise<void> {
  try {
    const ride = await Ride.findByIdAndDelete(req.params.rideId);
    if (!ride) { res.status(404).json({ success: false, error: 'Ride not found' }); return; }
    res.json({ success: true, message: 'Ride deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete ride' });
  }
}

/* ── Analytics: Rides per day ───────────────────────────── */
export async function analyticsRides(req: Request, res: Response): Promise<void> {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const data = await Ride.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({ success: true, data: data.map(d => ({ date: d._id, rides: d.count })) });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get ride analytics' });
  }
}

/* ── Analytics: Emissions saved per day ─────────────────── */
export async function analyticsEmissions(req: Request, res: Response): Promise<void> {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const data = await Ride.aggregate([
      { $match: { status: 'completed', updatedAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } }, co2SavedKg: { $sum: '$totalCO2Saved' } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({ success: true, data: data.map(d => ({ date: d._id, co2SavedKg: d.co2SavedKg / 1000 })) });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get emission analytics' });
  }
}

/* ── Analytics: Peak hours ──────────────────────────────── */
export async function analyticsPeakHours(req: Request, res: Response): Promise<void> {
  try {
    const data = await Ride.aggregate([
      { $group: { _id: { hour: { $hour: '$departureTime' }, day: { $dayOfWeek: '$departureTime' } }, count: { $sum: 1 } } },
      { $sort: { '_id.day': 1, '_id.hour': 1 } },
    ]);

    // Build 7×24 matrix
    const matrix: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const d of data) {
      const dayIdx = (d._id.day + 5) % 7; // Mongo Sunday=1 → Mon=0
      matrix[dayIdx][d._id.hour] = d.count;
    }

    res.json({ success: true, data: { matrix, days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get peak hours' });
  }
}

/* ── Analytics: User growth per day ─────────────────────── */
export async function analyticsUserGrowth(req: Request, res: Response): Promise<void> {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const data = await User.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({ success: true, data: data.map(d => ({ date: d._id, newUsers: d.count })) });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get user growth' });
  }
}

/* ── Chat Logs Viewer ───────────────────────────────────── */
export async function getChatLogs(req: Request, res: Response): Promise<void> {
  try {
    const { roomId } = req.params;
    const messages = await Message.find({ chatRoomId: roomId })
      .populate('sender', 'fullName avatarUrl email')
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();
    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get chat logs' });
  }
}

/* ── Seed Demo Data ─────────────────────────────────────── */
export async function seedDemoData(req: Request, res: Response): Promise<void> {
  try {
    await seedDatabase();
    res.json({ success: true, message: 'Demo data seeded successfully' });
  } catch (error) {
    logger.error('Seed error:', error);
    res.status(500).json({ success: false, error: 'Failed to seed data' });
  }
}
