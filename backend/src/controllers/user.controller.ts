import { Request, Response } from 'express';
import { User } from '../models/User';
import { Ride } from '../models/Ride';
import { updateUserGreenScore } from '../services/greenScore.service';
import { logger } from '../utils/logger';
import bcrypt from 'bcrypt';

export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user!.userId).select('-passwordHash -refreshTokens');
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    const { name, phone, bio, avatar, preferences } = req.body;
    const updateFields: Record<string, unknown> = {};
    if (name) updateFields.fullName = name;
    if (phone !== undefined) updateFields.phone = phone;
    if (bio !== undefined) updateFields.bio = bio;
    if (avatar) updateFields.avatarUrl = avatar;
    if (preferences) {
      if (preferences.smoking !== undefined) updateFields['preferences.smoking'] = preferences.smoking;
      if (preferences.music !== undefined) updateFields['preferences.music'] = preferences.music;
      if (preferences.pets !== undefined) updateFields['preferences.pets'] = preferences.pets;
      if (preferences.chatty !== undefined) updateFields['preferences.chatty'] = preferences.chatty;
      if (preferences.routePreference !== undefined) updateFields['preferences.routePreference'] = preferences.routePreference;
    }

    const user = await User.findByIdAndUpdate(req.user!.userId, { $set: updateFields }, { new: true, runValidators: true }).select('-passwordHash -refreshTokens');
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    res.json({ success: true, data: user, message: 'Profile updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) { res.status(400).json({ success: false, error: 'Both passwords required' }); return; }
    if (newPassword.length < 8) { res.status(400).json({ success: false, error: 'Password must be at least 8 characters' }); return; }

    const user = await User.findById(req.user!.userId);
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) { res.status(401).json({ success: false, error: 'Current password is incorrect' }); return; }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.refreshTokens = [];
    await user.save();

    res.json({ success: true, message: 'Password changed. Please log in again.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
}

export async function getMyStats(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.user!.userId).select('greenScore badges stats').lean();
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    const totalRidesCreated = await Ride.countDocuments({ driver: req.user!.userId });
    const totalRidesBooked = await Ride.countDocuments({ 'passengers.user': req.user!.userId, 'passengers.status': 'accepted' });

    res.json({
      success: true,
      data: {
        greenScore: user.greenScore,
        badges: user.badges,
        stats: user.stats,
        totalRidesCreated,
        totalRidesBooked,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
}

export async function getPublicProfile(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.params.userId)
      .select('fullName avatarUrl bio greenScore badges stats.totalRides stats.totalCO2Saved preferences createdAt')
      .lean();
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
}

export async function getLeaderboard(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const users = await User.find({ role: 'user' })
      .select('fullName avatarUrl greenScore badges stats.totalRides stats.totalCO2Saved')
      .sort({ greenScore: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await User.countDocuments({ role: 'user' });

    // Find requesting user's rank
    let myRank: number | null = null;
    if (req.user) {
      const myScore = await User.findById(req.user.userId).select('greenScore').lean();
      if (myScore) {
        myRank = await User.countDocuments({ role: 'user', greenScore: { $gt: myScore.greenScore } }) + 1;
      }
    }

    res.json({
      success: true,
      data: {
        users: users.map((u, i) => ({ ...u, rank: skip + i + 1 })),
        myRank,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get leaderboard' });
  }
}
