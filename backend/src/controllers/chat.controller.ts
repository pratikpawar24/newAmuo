import { Request, Response } from 'express';
import { Message } from '../models/Message';
import { Ride } from '../models/Ride';
import { createNotification } from '../services/notification.service';
import { logger } from '../utils/logger';

export async function getRooms(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }

    const rides = await Ride.find({
      $or: [{ creator: req.user.userId }, { 'passengers.userId': req.user.userId }],
    })
      .populate('creator', 'fullName avatarUrl')
      .populate('passengers.userId', 'fullName avatarUrl')
      .lean();

    const rooms = await Promise.all(
      rides.map(async (ride) => {
        const lastMessage = await Message.findOne({ chatRoomId: ride.chatRoomId }).sort({ createdAt: -1 }).lean();
        const unreadCount = await Message.countDocuments({
          chatRoomId: ride.chatRoomId,
          sender: { $ne: req.user!.userId },
          readBy: { $ne: req.user!.userId },
        });
        return {
          roomId: ride.chatRoomId,
          rideId: ride._id,
          rideName: `${ride.origin.address || 'Origin'} → ${ride.destination.address || 'Destination'}`,
          rideStatus: ride.status,
          lastMessage: lastMessage ? { content: lastMessage.content, createdAt: lastMessage.createdAt, messageType: lastMessage.messageType } : null,
          unreadCount,
          participants: [ride.creator, ...ride.passengers.map((p: any) => p.userId)],
        };
      })
    );

    res.json({ success: true, data: rooms.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt?.getTime() || 0;
      const bTime = b.lastMessage?.createdAt?.getTime() || 0;
      return bTime - aTime;
    })});
  } catch (error) {
    logger.error('Get rooms error:', error);
    res.status(500).json({ success: false, error: 'Failed to get rooms' });
  }
}

export async function getMessages(req: Request, res: Response): Promise<void> {
  try {
    const { roomId } = req.params;
    const { cursor, limit = '50' } = req.query;

    const filter: Record<string, unknown> = { chatRoomId: roomId };
    if (cursor) filter.createdAt = { $lt: new Date(cursor as string) };

    const messages = await Message.find(filter)
      .populate('sender', 'fullName avatarUrl')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .lean();

    // Mark as read
    if (req.user) {
      await Message.updateMany(
        { chatRoomId: roomId, readBy: { $ne: req.user.userId } },
        { $addToSet: { readBy: req.user.userId } }
      );
    }

    res.json({ success: true, data: messages.reverse() });
  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({ success: false, error: 'Failed to get messages' });
  }
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }
    const { roomId } = req.params;
    const { content, messageType = 'text' } = req.body;

    const message = await Message.create({
      chatRoomId: roomId,
      sender: req.user.userId,
      content,
      messageType,
      readBy: [req.user.userId],
    });

    const populated = await message.populate('sender', 'fullName avatarUrl');

    const io = req.app.get('io');
    if (io) io.to(`chat:${roomId}`).emit('chat:new_message', populated);

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
}

export async function sendPriceOffer(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }
    const { roomId } = req.params;
    const { priceOffer } = req.body;

    const message = await Message.create({
      chatRoomId: roomId,
      sender: req.user.userId,
      content: `Price offer: ₹${priceOffer}`,
      messageType: 'price_offer',
      priceOffer,
      readBy: [req.user.userId],
    });

    const populated = await message.populate('sender', 'fullName avatarUrl');
    const io = req.app.get('io');
    if (io) io.to(`chat:${roomId}`).emit('chat:price_offer', populated);

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    logger.error('Price offer error:', error);
    res.status(500).json({ success: false, error: 'Failed to send price offer' });
  }
}

export async function respondToPrice(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }
    const { roomId } = req.params;
    const { accept, offeredPrice } = req.body;

    const messageType = accept ? 'price_accept' : 'price_reject';
    const content = accept ? `Price accepted: ₹${offeredPrice}` : `Price rejected: ₹${offeredPrice}`;

    const message = await Message.create({
      chatRoomId: roomId,
      sender: req.user.userId,
      content,
      messageType,
      priceOffer: offeredPrice,
      readBy: [req.user.userId],
    });

    if (accept) {
      // Find ride by chatRoomId and update fare
      const ride = await Ride.findOne({ chatRoomId: roomId });
      if (ride) {
        const passengerEntry = ride.passengers.find(p => p.userId.toString() !== req.user!.userId && (p.status === 'pending' || p.status === 'accepted'));
        if (passengerEntry) {
          passengerEntry.fare = offeredPrice;
          await ride.save();
        }
      }
    }

    const populated = await message.populate('sender', 'fullName avatarUrl');
    const io = req.app.get('io');
    if (io) io.to(`chat:${roomId}`).emit('chat:price_response', populated);

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    logger.error('Price response error:', error);
    res.status(500).json({ success: false, error: 'Failed to respond to price' });
  }
}
