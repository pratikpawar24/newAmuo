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

router.use(authenticate);

router.post('/', createRide);
router.get('/', listRides);
router.get('/my/created', getMyCreatedRides);
router.get('/my/booked', getMyBookedRides);
router.get('/search/match', searchMatch);
router.get('/:rideId', getRide);
router.post('/:rideId/book', bookRide);
router.patch('/:rideId/booking/:passengerId/respond', respondToBooking);
router.patch('/:rideId/status', updateRideStatus);
router.delete('/:rideId', deleteRide);

export default router;
