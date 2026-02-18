import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env, getCorsOrigins, isProduction } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';

import authRoutes from './routes/auth.routes';
import rideRoutes from './routes/ride.routes';
import chatRoutes from './routes/chat.routes';
import trafficRoutes from './routes/traffic.routes';
import userRoutes from './routes/user.routes';
import adminRoutes from './routes/admin.routes';
import routeRoutes from './routes/route.routes';

const app = express();

// ─── Trust Proxy (for Render/Vercel) ────────────────────────────────────────
if (isProduction) {
  app.set('trust proxy', 1);
}

// ─── Security ───────────────────────────────────────────────────────────────
app.use(helmet({ 
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: isProduction ? undefined : false,
}));

const corsOrigins = getCorsOrigins();
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin) || corsOrigins.includes('*')) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// ─── Body Parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());

// ─── Logging ────────────────────────────────────────────────────────────────
if (env.NODE_ENV !== 'test') {
  app.use(morgan('short'));
}

// ─── Rate Limiting ──────────────────────────────────────────────────────────
app.use(generalLimiter);

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

// ─── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/traffic', trafficRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/routes', routeRoutes);

// ─── 404 ────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── Global Error Handler ───────────────────────────────────────────────────
app.use(errorHandler);

export default app;
