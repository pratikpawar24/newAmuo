import { Router } from 'express';
import { getRooms, getMessages, sendMessage, sendPriceOffer, respondToPrice } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/rooms', getRooms);
router.get('/rooms/:roomId/messages', getMessages);
router.post('/rooms/:roomId/messages', sendMessage);
router.post('/rooms/:roomId/price-offer', sendPriceOffer);
router.post('/rooms/:roomId/price-respond', respondToPrice);

export default router;
