/**
 * Green Mobility Score calculation.
 *
 * GreenScore = min(100, RideShare + CO₂Saved + DistSaved + Consistency)
 *   RideShare  = min(30, shared_rides/total_rides × 30)
 *   CO₂Saved   = min(30, total_co2_saved_kg/100 × 30)
 *   DistSaved  = min(25, distance_saved_km/500 × 25)
 *   Consistency = min(15, active_days_last_30/30 × 15)
 *
 * Badges:
 *   ≥20 → "Eco Starter" 🌱
 *   ≥40 → "Carbon Cutter" ✂️
 *   ≥60 → "Eco Warrior" 🛡️
 *   ≥80 → "Planet Protector" 🌍
 *   =100 → "Climate Champion" 🏆
 */

import { User, IUser } from '../models/User';
import { createNotification } from './notification.service';
import { logger } from '../utils/logger';

const BADGE_THRESHOLDS: Array<{ score: number; name: string; emoji: string }> = [
  { score: 100, name: 'Climate Champion', emoji: '🏆' },
  { score: 80, name: 'Planet Protector', emoji: '🌍' },
  { score: 60, name: 'Eco Warrior', emoji: '🛡️' },
  { score: 40, name: 'Carbon Cutter', emoji: '✂️' },
  { score: 20, name: 'Eco Starter', emoji: '🌱' },
];

export function calculateGreenScore(stats: IUser['stats']): number {
  const totalRides = stats.totalRidesCreated + stats.totalRidesBooked;
  const rideShare = totalRides > 0 ? Math.min(30, (stats.sharedRidesCount / totalRides) * 30) : 0;
  const co2Saved = Math.min(30, (stats.totalCO2SavedKg / 100) * 30);
  const distSaved = Math.min(25, (stats.totalDistanceKm / 500) * 25);

  // Count active days in last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const activeDays = stats.activeDaysLast30.filter((d: Date) => d >= thirtyDaysAgo).length;
  const consistency = Math.min(15, (activeDays / 30) * 15);

  return Math.min(100, Math.round(rideShare + co2Saved + distSaved + consistency));
}

export function determineBadges(score: number): string[] {
  const badges: string[] = [];
  for (const threshold of BADGE_THRESHOLDS) {
    if (score >= threshold.score) {
      badges.push(`${threshold.name} ${threshold.emoji}`);
    }
  }
  return badges;
}

export async function updateUserGreenScore(userId: string, io?: any): Promise<number> {
  try {
    const user = await User.findById(userId);
    if (!user) return 0;

    const newScore = calculateGreenScore(user.stats);
    const oldBadges = new Set(user.badges);
    const newBadges = determineBadges(newScore);

    // Check for newly earned badges
    for (const badge of newBadges) {
      if (!oldBadges.has(badge)) {
        await createNotification(
          userId,
          'badge_earned',
          'New Badge Earned! 🎉',
          `You earned the "${badge}" badge!`,
          { badge },
          io
        );
        logger.info(`User ${userId} earned badge: ${badge}`);
      }
    }

    user.greenScore = newScore;
    user.badges = newBadges;
    await user.save();

    return newScore;
  } catch (error) {
    logger.error('Update green score error:', error);
    return 0;
  }
}

export async function addActiveDay(userId: string): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await User.findByIdAndUpdate(userId, {
    $addToSet: { 'stats.activeDaysLast30': today },
  });
}
