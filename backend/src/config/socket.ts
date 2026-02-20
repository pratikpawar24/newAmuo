import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './env';
import { Message } from '../models/Message';
import { User } from '../models/User';
import { logger } from '../utils/logger';

let io: Server;

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userName?: string;
}

export function initSocket(httpServer: HTTPServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; email: string };
      const user = await User.findById(decoded.userId).select('fullName').lean();
      if (!user) return next(new Error('User not found'));

      socket.userId = decoded.userId;
      socket.userName = (user as any).fullName;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (rawSocket: Socket) => {
    const socket = rawSocket as AuthenticatedSocket;
    logger.info(`Socket connected: ${socket.userId} (${socket.userName})`);

    // Join personal room for notifications
    socket.join(`user:${socket.userId}`);

    // ─── Ride Room Events ──────────────────────────────────────────────

    socket.on('ride:join_room', (data: { rideId: string }) => {
      socket.join(`ride:${data.rideId}`);
      logger.debug(`User ${socket.userId} joined ride room ${data.rideId}`);
    });

    socket.on('ride:leave_room', (data: { rideId: string }) => {
      socket.leave(`ride:${data.rideId}`);
    });

    // ─── Chat Events ───────────────────────────────────────────────────

    socket.on('chat:join', (chatRoomId: string) => {
      socket.join(`chat:${chatRoomId}`);
      socket.to(`chat:${chatRoomId}`).emit('chat:user_joined', {
        userId: socket.userId,
        userName: socket.userName,
        chatRoomId,
      });
      logger.debug(`User ${socket.userId} joined chat ${chatRoomId}`);
    });

    socket.on('chat:leave', (chatRoomId: string) => {
      socket.leave(`chat:${chatRoomId}`);
      socket.to(`chat:${chatRoomId}`).emit('chat:user_left', {
        userId: socket.userId,
        chatRoomId,
      });
    });

    socket.on('chat:message', async (data: { chatRoomId: string; content: string }) => {
      try {
        const message = await Message.create({
          chatRoomId: data.chatRoomId,
          sender: socket.userId,
          content: data.content,
          messageType: 'text',
          readBy: [socket.userId],
        });

        const populated = await Message.findById(message._id)
          .populate('sender', 'name avatar')
          .lean();

        io.to(`chat:${data.chatRoomId}`).emit('chat:new_message', populated);
      } catch (error) {
        socket.emit('chat:error', { message: 'Failed to send message' });
        logger.error('Chat message error:', error);
      }
    });

    socket.on('chat:typing', (data: { chatRoomId: string; isTyping: boolean }) => {
      socket.to(`chat:${data.chatRoomId}`).emit('chat:user_typing', {
        userId: socket.userId,
        userName: socket.userName,
        isTyping: data.isTyping,
        chatRoomId: data.chatRoomId,
      });
    });

    socket.on('chat:stop_typing', (data: { chatRoomId: string }) => {
      socket.to(`chat:${data.chatRoomId}`).emit('chat:user_typing', {
        userId: socket.userId,
        userName: socket.userName,
        isTyping: false,
        chatRoomId: data.chatRoomId,
      });
    });

    socket.on('chat:send_message', async (data: { roomId: string; content: string; messageType?: string; priceOffer?: number }) => {
      try {
        const message = await Message.create({
          chatRoomId: data.roomId,
          sender: socket.userId,
          content: data.content,
          messageType: data.messageType || 'text',
          priceOffer: data.priceOffer,
          readBy: [socket.userId],
        });

        const populated = await Message.findById(message._id)
          .populate('sender', 'fullName avatarUrl')
          .lean();

        io.to(`chat:${data.roomId}`).emit('chat:new_message', populated);
      } catch (error) {
        socket.emit('chat:error', { message: 'Failed to send message' });
        logger.error('Chat send_message error:', error);
      }
    });

    socket.on('chat:read', async (data: { chatRoomId: string }) => {
      try {
        await Message.updateMany(
          { chatRoomId: data.chatRoomId, readBy: { $ne: socket.userId } },
          { $addToSet: { readBy: socket.userId } }
        );
        socket.to(`chat:${data.chatRoomId}`).emit('chat:messages_read', {
          userId: socket.userId,
          chatRoomId: data.chatRoomId,
        });
      } catch (error) {
        logger.error('Chat read error:', error);
      }
    });

    // ─── Price Negotiation Events ───────────────────────────────────────

    socket.on('chat:price_offer', async (data: { chatRoomId: string; amount: number }) => {
      try {
        const message = await Message.create({
          chatRoomId: data.chatRoomId,
          sender: socket.userId,
          content: `Price offer: ₹${data.amount}`,
          messageType: 'price_offer',
          priceOffer: {
            amount: data.amount,
            status: 'pending',
          },
          readBy: [socket.userId],
        });

        const populated = await Message.findById(message._id)
          .populate('sender', 'name avatar')
          .lean();

        io.to(`chat:${data.chatRoomId}`).emit('chat:price_update', populated);
      } catch (error) {
        socket.emit('chat:error', { message: 'Failed to send price offer' });
      }
    });

    socket.on('chat:price_respond', async (data: { messageId: string; status: 'accepted' | 'rejected' }) => {
      try {
        const message = await Message.findByIdAndUpdate(
          data.messageId,
          { 'priceOffer.status': data.status },
          { new: true }
        ).populate('sender', 'name avatar').lean();

        if (message) {
          io.to(`chat:${message.chatRoomId}`).emit('chat:price_update', message);
        }
      } catch (error) {
        socket.emit('chat:error', { message: 'Failed to respond to price' });
      }
    });

    // ─── Ride Events ────────────────────────────────────────────────────

    socket.on('ride:subscribe', (rideId: string) => {
      socket.join(`ride:${rideId}`);
    });

    socket.on('ride:unsubscribe', (rideId: string) => {
      socket.leave(`ride:${rideId}`);
    });

    socket.on('ride:location_update', (data: { rideId: string; lat: number; lng: number }) => {
      socket.to(`ride:${data.rideId}`).emit('location:driver_update', {
        userId: socket.userId,
        lat: data.lat,
        lng: data.lng,
        timestamp: new Date().toISOString(),
      });
    });

    // ─── Traffic Events ─────────────────────────────────────────────────

    socket.on('traffic:subscribe', (region: string) => {
      socket.join(`traffic:${region}`);
    });

    socket.on('traffic:unsubscribe', (region: string) => {
      socket.leave(`traffic:${region}`);
    });

    // ─── Disconnect ─────────────────────────────────────────────────────

    socket.on('disconnect', (reason: string) => {
      logger.info(`Socket disconnected: ${socket.userId} (${reason})`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

// ─── Helper emitters ──────────────────────────────────────────────────────────

export function emitToUser(userId: string, event: string, data: unknown): void {
  io?.to(`user:${userId}`).emit(event, data);
}

export function emitToChat(chatRoomId: string, event: string, data: unknown): void {
  io?.to(`chat:${chatRoomId}`).emit(event, data);
}

export function emitToRide(rideId: string, event: string, data: unknown): void {
  io?.to(`ride:${rideId}`).emit(event, data);
}

export function emitTrafficUpdate(region: string, data: unknown): void {
  io?.to(`traffic:${region}`).emit('traffic:update', data);
}

export function emitRouteUpdate(rideId: string, route: unknown, status: unknown): void {
  io?.to(`route:${rideId}`).emit('route:updated', { rideId, route, status });
}
