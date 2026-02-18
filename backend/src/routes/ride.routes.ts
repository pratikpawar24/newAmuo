import { Router } from 'express';
import {
  createRide,
  listRides,
  getRide,
  bookRide,
  respondToBooking,
  updateRideStatus,
  deleteRide,
  getMyCreatedRides,
  getMyBookedRides,
  searchMatch,
} from '../controllers/ride.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Public routes — no auth required
router.get('/', listRides);

// Authenticated routes — must come before /:rideId to avoid path conflicts
router.post('/', authenticate, createRide);
router.get('/my/created', authenticate, getMyCreatedRides);
router.get('/my/booked', authenticate, getMyBookedRides);
router.get('/search/match', authenticate, searchMatch);

// Public single ride view
router.get('/:rideId', getRide);

// Authenticated ride actions
router.post('/:rideId/book', authenticate, bookRide);
router.patch('/:rideId/booking/:passengerId/respond', authenticate, respondToBooking);
router.patch('/:rideId/status', authenticate, updateRideStatus);
router.delete('/:rideId', authenticate, deleteRide);

export default router;
