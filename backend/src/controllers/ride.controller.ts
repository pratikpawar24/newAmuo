import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Ride } from '../models/Ride';
import { User } from '../models/User';
import { haversine, haversineKm } from '../utils/haversine';
import { emissionFactor } from '../utils/emissions';
import { updateUserGreenScore, addActiveDay } from '../services/greenScore.service';
import { createNotification } from '../services/notification.service';
import { matchRides as aiMatchRides } from '../services/ai.service';
import { logger } from '../utils/logger';

// ── Route overlap helpers ─────────────────────────────────────────────────────

/** Find the minimum distance (metres) from a point to any point on a polyline */
function pointToPolylineMinDist(lat: number, lng: number, polyline: number[][]): number {
  let min = Infinity;
  for (const p of polyline) {
    const d = haversine(lat, lng, p[0], p[1]);
    if (d < min) min = d;
  }
  return min;
}

/** Check if a rider's origin→dest falls along a driver's polyline.
 *  Returns { onRoute, pickupDistM, dropoffDistM, overlapRatio, detourKm, co2SavedKg, sharedDistKm }
 */
function checkRouteOverlap(
  riderOriginLat: number, riderOriginLng: number,
  riderDestLat: number, riderDestLng: number,
  driverPolyline: number[][],
  maxProximityM = 3000, // 3 km threshold
): {
  onRoute: boolean;
  pickupDistM: number;
  dropoffDistM: number;
  overlapRatio: number;
  sharedDistKm: number;
  detourKm: number;
  co2SavedKg: number;
} {
  if (!driverPolyline || driverPolyline.length < 2) {
    return { onRoute: false, pickupDistM: Infinity, dropoffDistM: Infinity, overlapRatio: 0, sharedDistKm: 0, detourKm: 0, co2SavedKg: 0 };
  }

  const pickupDistM = pointToPolylineMinDist(riderOriginLat, riderOriginLng, driverPolyline);
  const dropoffDistM = pointToPolylineMinDist(riderDestLat, riderDestLng, driverPolyline);

  // Both pickup and dropoff must be within proximity threshold
  if (pickupDistM > maxProximityM || dropoffDistM > maxProximityM) {
    return { onRoute: false, pickupDistM, dropoffDistM, overlapRatio: 0, sharedDistKm: 0, detourKm: 0, co2SavedKg: 0 };
  }

  // Find projection indices (ensure pickup comes before dropoff = same direction)
  let pickupIdx = 0, dropoffIdx = 0;
  let minPickup = Infinity, minDropoff = Infinity;
  for (let i = 0; i < driverPolyline.length; i++) {
    const dp = haversine(riderOriginLat, riderOriginLng, driverPolyline[i][0], driverPolyline[i][1]);
    const dd = haversine(riderDestLat, riderDestLng, driverPolyline[i][0], driverPolyline[i][1]);
    if (dp < minPickup) { minPickup = dp; pickupIdx = i; }
    if (dd < minDropoff) { minDropoff = dd; dropoffIdx = i; }
  }

  // Pickup must come before dropoff along the route (same direction)
  if (pickupIdx >= dropoffIdx) {
    return { onRoute: false, pickupDistM, dropoffDistM, overlapRatio: 0, sharedDistKm: 0, detourKm: 0, co2SavedKg: 0 };
  }

  // Calculate total route length and shared segment length
  let totalLen = 0, sharedLen = 0;
  for (let i = 0; i < driverPolyline.length - 1; i++) {
    const seg = haversine(driverPolyline[i][0], driverPolyline[i][1], driverPolyline[i + 1][0], driverPolyline[i + 1][1]);
    totalLen += seg;
    if (i >= pickupIdx && i < dropoffIdx) sharedLen += seg;
  }

  const overlapRatio = totalLen > 0 ? sharedLen / totalLen : 0;
  const sharedDistKm = sharedLen / 1000;
  const detourKm = (pickupDistM + dropoffDistM) / 1000;
  const avgSpeed = 30;
  const co2Solo = sharedDistKm * emissionFactor(avgSpeed, 'petrol') / 1000;
  const co2Shared = co2Solo / 2; // sharing with driver
  const co2SavedKg = Math.max(co2Solo - co2Shared, 0);

  return { onRoute: true, pickupDistM, dropoffDistM, overlapRatio, sharedDistKm, detourKm, co2SavedKg };
}

export async function createRide(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }

    const { origin, destination, departureTime, vehicleInfo, pricePerSeat, totalSeats, routePolyline } = req.body;

    const distKm = haversineKm(
      origin.coordinates.lat, origin.coordinates.lng,
      destination.coordinates.lat, destination.coordinates.lng
    );
    const avgSpeed = 30;
    const durationMin = (distKm / avgSpeed) * 60;
    const co2PerKm = emissionFactor(avgSpeed, vehicleInfo?.fuelType || 'petrol');
    const chatRoomId = uuidv4();

    const ride = await Ride.create({
      creator: req.user.userId,
      origin,
      destination,
      routePolyline: routePolyline || [[origin.coordinates.lat, origin.coordinates.lng], [destination.coordinates.lat, destination.coordinates.lng]],
      departureTime: new Date(departureTime),
      estimatedArrival: new Date(new Date(departureTime).getTime() + durationMin * 60000),
      totalDistanceKm: Math.round(distKm * 100) / 100,
      estimatedDurationMin: Math.round(durationMin),
      pricePerSeat: pricePerSeat || 0,
      totalSeats: totalSeats || 4,
      availableSeats: totalSeats || 4,
      vehicleInfo: vehicleInfo || {},
      co2PerKm,
      chatRoomId,
    });

    await User.findByIdAndUpdate(req.user.userId, { $inc: { 'stats.totalRidesCreated': 1 } });
    await addActiveDay(req.user.userId);

    const io = req.app.get('io');
    if (io) io.emit('ride:created', ride);

    res.status(201).json({ success: true, data: ride });
  } catch (error) {
    logger.error('Create ride error:', error);
    res.status(500).json({ success: false, error: 'Failed to create ride' });
  }
}

export async function listRides(req: Request, res: Response): Promise<void> {
  try {
    const { originLat, originLng, destLat, destLng, radius, departureAfter, departureBefore, minSeats, maxPrice, page = '1', limit = '20' } = req.query;

    const filter: Record<string, unknown> = { status: 'active' };

    if (departureAfter) filter.departureTime = { ...filter.departureTime as object, $gte: new Date(departureAfter as string) };
    if (departureBefore) filter.departureTime = { ...filter.departureTime as object, $lte: new Date(departureBefore as string) };
    if (minSeats) filter.availableSeats = { $gte: parseInt(minSeats as string) };
    if (maxPrice) filter.pricePerSeat = { $lte: parseFloat(maxPrice as string) };

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    let rides = await Ride.find(filter)
      .populate('creator', 'fullName avatarUrl greenScore badges')
      .sort({ departureTime: 1 })
      .skip(skip)
      .limit(parseInt(limit as string) * 3) // fetch more to filter later
      .lean();

    const hasRouteFilter = originLat && originLng && destLat && destLng;

    if (hasRouteFilter) {
      // Smart route-based filtering: show rides where user's origin→dest falls on the ride's route
      const oLat = parseFloat(originLat as string);
      const oLng = parseFloat(originLng as string);
      const dLat = parseFloat(destLat as string);
      const dLng = parseFloat(destLng as string);
      const maxProx = (parseFloat(radius as string) || 3) * 1000; // km → m

      const enriched = rides
        .map((ride) => {
          const overlap = checkRouteOverlap(oLat, oLng, dLat, dLng, ride.routePolyline || [], maxProx);
          return { ...ride, routeMatch: overlap };
        })
        .filter((r) => r.routeMatch.onRoute)
        .sort((a, b) => b.routeMatch.overlapRatio - a.routeMatch.overlapRatio);

      rides = enriched.slice(0, parseInt(limit as string));
    } else if (originLat && originLng) {
      // Fallback: simple origin radius filter
      const r = parseFloat(radius as string) || 10;
      rides = rides.filter((ride) => {
        const d = haversineKm(
          parseFloat(originLat as string), parseFloat(originLng as string),
          ride.origin.coordinates.lat, ride.origin.coordinates.lng
        );
        return d <= r;
      });
      rides = rides.slice(0, parseInt(limit as string));
    } else {
      rides = rides.slice(0, parseInt(limit as string));
    }

    const total = await Ride.countDocuments(filter);

    res.json({ success: true, data: { rides, total, page: parseInt(page as string), limit: parseInt(limit as string) } });
  } catch (error) {
    logger.error('List rides error:', error);
    res.status(500).json({ success: false, error: 'Failed to list rides' });
  }
}

export async function getRide(req: Request, res: Response): Promise<void> {
  try {
    const ride = await Ride.findById(req.params.rideId)
      .populate('creator', 'fullName avatarUrl greenScore badges email')
      .populate('passengers.userId', 'fullName avatarUrl greenScore');
    if (!ride) { res.status(404).json({ success: false, error: 'Ride not found' }); return; }
    res.json({ success: true, data: ride });
  } catch (error) {
    logger.error('Get ride error:', error);
    res.status(500).json({ success: false, error: 'Failed to get ride' });
  }
}

export async function bookRide(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }
    const ride = await Ride.findById(req.params.rideId);
    if (!ride) { res.status(404).json({ success: false, error: 'Ride not found' }); return; }
    if (ride.availableSeats <= 0) { res.status(400).json({ success: false, error: 'No seats available' }); return; }
    if (ride.creator.toString() === req.user.userId) { res.status(400).json({ success: false, error: 'Cannot book your own ride' }); return; }

    const already = ride.passengers.find((p) => p.userId.toString() === req.user!.userId && p.status !== 'cancelled');
    if (already) { res.status(400).json({ success: false, error: 'Already booked' }); return; }

    const { pickup, dropoff } = req.body;
    const riderDist = haversineKm(pickup?.coordinates?.lat || ride.origin.coordinates.lat, pickup?.coordinates?.lng || ride.origin.coordinates.lng, dropoff?.coordinates?.lat || ride.destination.coordinates.lat, dropoff?.coordinates?.lng || ride.destination.coordinates.lng);
    const co2Solo = (riderDist * emissionFactor(30, ride.vehicleInfo.fuelType)) / 1000;
    const co2Shared = (riderDist * emissionFactor(30, ride.vehicleInfo.fuelType)) / (ride.passengers.filter(p => p.status === 'accepted').length + 2) / 1000;
    const co2Saved = Math.max(co2Solo - co2Shared, 0);

    ride.passengers.push({
      userId: req.user.userId as any,
      pickup: pickup || { address: '', coordinates: ride.origin.coordinates },
      dropoff: dropoff || { address: '', coordinates: ride.destination.coordinates },
      status: 'pending',
      co2SavedKg: Math.round(co2Saved * 100) / 100,
      fare: ride.pricePerSeat,
      bookedAt: new Date(),
    });
    await ride.save();

    const io = req.app.get('io');
    if (io) io.to(`ride:${ride._id}`).emit('ride:booking_request', { rideId: ride._id, userId: req.user.userId });

    await createNotification(ride.creator.toString(), 'ride_request', 'New Booking Request', `Someone wants to join your ride!`, { rideId: ride._id }, io);

    res.json({ success: true, data: ride });
  } catch (error) {
    logger.error('Book ride error:', error);
    res.status(500).json({ success: false, error: 'Failed to book ride' });
  }
}

export async function respondToBooking(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }
    const ride = await Ride.findById(req.params.rideId);
    if (!ride) { res.status(404).json({ success: false, error: 'Ride not found' }); return; }
    if (ride.creator.toString() !== req.user.userId) { res.status(403).json({ success: false, error: 'Only creator can respond' }); return; }

    const passenger = ride.passengers.find((p) => p.userId.toString() === req.params.passengerId);
    if (!passenger) { res.status(404).json({ success: false, error: 'Passenger not found' }); return; }

    const { action } = req.body; // 'accept' or 'reject'
    passenger.status = action === 'accept' ? 'accepted' : 'rejected';
    if (action === 'accept') {
      ride.availableSeats = Math.max(0, ride.availableSeats - 1);
      ride.waypoints.push({ lat: passenger.pickup.coordinates.lat, lng: passenger.pickup.coordinates.lng, type: 'pickup', userId: passenger.userId });
      ride.waypoints.push({ lat: passenger.dropoff.coordinates.lat, lng: passenger.dropoff.coordinates.lng, type: 'dropoff', userId: passenger.userId });
    }
    await ride.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`ride:${ride._id}`).emit('ride:booking_response', { rideId: ride._id, passengerId: req.params.passengerId, status: passenger.status });
      io.to(`ride:${ride._id}`).emit('ride:seats_updated', { rideId: ride._id, availableSeats: ride.availableSeats });
    }

    const notifType = action === 'accept' ? 'ride_accepted' : 'ride_cancelled';
    await createNotification(passenger.userId.toString(), notifType, action === 'accept' ? 'Booking Accepted! 🎉' : 'Booking Declined', action === 'accept' ? 'Your ride booking has been accepted!' : 'Your ride booking was declined.', { rideId: ride._id }, io);

    res.json({ success: true, data: ride });
  } catch (error) {
    logger.error('Respond booking error:', error);
    res.status(500).json({ success: false, error: 'Failed to respond to booking' });
  }
}

export async function updateRideStatus(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }
    const ride = await Ride.findById(req.params.rideId);
    if (!ride) { res.status(404).json({ success: false, error: 'Ride not found' }); return; }
    if (ride.creator.toString() !== req.user.userId) { res.status(403).json({ success: false, error: 'Only creator can update' }); return; }

    const { status } = req.body;
    ride.status = status;

    if (status === 'completed') {
      let totalCO2Saved = 0;
      for (const p of ride.passengers.filter((p) => p.status === 'accepted')) {
        p.status = 'completed';
        totalCO2Saved += p.co2SavedKg;

        await User.findByIdAndUpdate(p.userId, {
          $inc: { 'stats.totalRidesBooked': 1, 'stats.totalDistanceKm': ride.totalDistanceKm, 'stats.totalCO2SavedKg': p.co2SavedKg, 'stats.sharedRidesCount': 1 },
        });
        await addActiveDay(p.userId.toString());
        const io = req.app.get('io');
        await updateUserGreenScore(p.userId.toString(), io);
      }

      ride.totalCO2Saved = totalCO2Saved;
      await User.findByIdAndUpdate(req.user.userId, {
        $inc: { 'stats.totalDistanceKm': ride.totalDistanceKm, 'stats.totalCO2SavedKg': totalCO2Saved, 'stats.sharedRidesCount': 1 },
      });
      await addActiveDay(req.user.userId);
      const io = req.app.get('io');
      await updateUserGreenScore(req.user.userId, io);
    }

    await ride.save();

    const io = req.app.get('io');
    if (io) io.to(`ride:${ride._id}`).emit('ride:status_updated', { rideId: ride._id, status });

    res.json({ success: true, data: ride });
  } catch (error) {
    logger.error('Update ride status error:', error);
    res.status(500).json({ success: false, error: 'Failed to update ride status' });
  }
}

export async function deleteRide(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }
    const ride = await Ride.findById(req.params.rideId);
    if (!ride) { res.status(404).json({ success: false, error: 'Ride not found' }); return; }
    if (ride.creator.toString() !== req.user.userId) { res.status(403).json({ success: false, error: 'Only creator can delete' }); return; }
    if (ride.status !== 'active') { res.status(400).json({ success: false, error: 'Can only cancel active rides' }); return; }

    ride.status = 'cancelled';
    await ride.save();

    const io = req.app.get('io');
    if (io) io.to(`ride:${ride._id}`).emit('ride:status_updated', { rideId: ride._id, status: 'cancelled' });

    res.json({ success: true, message: 'Ride cancelled' });
  } catch (error) {
    logger.error('Delete ride error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel ride' });
  }
}

export async function getMyCreatedRides(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }
    const rides = await Ride.find({ creator: req.user.userId }).populate('passengers.userId', 'fullName avatarUrl').sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: rides });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get rides' });
  }
}

export async function getMyBookedRides(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }
    const rides = await Ride.find({ 'passengers.userId': req.user.userId }).populate('creator', 'fullName avatarUrl greenScore').sort({ departureTime: -1 }).lean();
    res.json({ success: true, data: rides });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get rides' });
  }
}

export async function searchMatch(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }
    const { originLat, originLng, destLat, destLng, departureTime } = req.query;

    const activeRides = await Ride.find({ status: 'active', availableSeats: { $gt: 0 } }).populate('creator', 'fullName avatarUrl greenScore preferences').lean();

    const rideData = activeRides.map((r) => ({
      rideId: r._id.toString(),
      origin: r.origin.coordinates,
      destination: r.destination.coordinates,
      polyline: r.routePolyline || [],
      departureTime: r.departureTime.toISOString(),
      preferences: {},
    }));

    const result = await aiMatchRides(
      { lat: parseFloat(originLat as string) || 0, lng: parseFloat(originLng as string) || 0 },
      { lat: parseFloat(destLat as string) || 0, lng: parseFloat(destLng as string) || 0 },
      (departureTime as string) || new Date().toISOString(),
      {},
      rideData
    );

    // Enrich with ride details
    const enriched = (result.matches || []).map((m: any) => {
      const ride = activeRides.find((r) => r._id.toString() === m.rideId);
      return { ...m, ride };
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    logger.error('Search match error:', error);
    res.status(500).json({ success: false, error: 'Failed to search matches' });
  }
}
