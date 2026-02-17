import { Router } from 'express';
import { getRooms, getMessages, sendMessage, sendPriceOffer, respondToPrice } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/rooms', getRooms);
router.get('/rooms/:chatRoomId/messages', getMessages);
router.post('/rooms/:chatRoomId/messages', sendMessage);
router.post('/rooms/:chatRoomId/price-offer', sendPriceOffer);
router.patch('/messages/:messageId/price-response', respondToPrice);

export default router;
