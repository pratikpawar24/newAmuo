import { User } from '../models/User';
import { Ride } from '../models/Ride';
import { SiteStats } from '../models/SiteStats';
import { logger } from '../utils/logger';

export async function aggregateDailyStats(): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalUsers = await User.countDocuments();
    const totalRidesCreated = await Ride.countDocuments({ createdAt: { $gte: today } });
    const totalRidesCompleted = await Ride.countDocuments({ status: 'completed', updatedAt: { $gte: today } });

    const co2Result = await Ride.aggregate([
      { $match: { status: 'completed', updatedAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$totalCO2Saved' } } },
    ]);
    const totalCO2SavedKg = co2Result.length > 0 ? co2Result[0].total / 1000 : 0;

    // Peak hour distribution
    const hourDist = await Ride.aggregate([
      { $match: { createdAt: { $gte: today } } },
      { $group: { _id: { $hour: '$departureTime' }, count: { $sum: 1 } } },
    ]);
    const peakHours = new Array(24).fill(0);
    for (const h of hourDist) {
      if (h._id >= 0 && h._id < 24) peakHours[h._id] = h.count;
    }

    await SiteStats.findOneAndUpdate(
      { date: today },
      {
        date: today,
        totalUsers,
        totalRidesCreated,
        totalRidesCompleted,
        totalCO2SavedKg,
        peakHourDistribution: peakHours,
        $inc: { totalVisitors: 1 },
      },
      { upsert: true, new: true }
    );

    logger.info('Daily stats aggregated');
  } catch (error) {
    logger.error('Stats aggregation error:', error);
  }
}
