import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Database
  MONGODB_URI: z.string().default('mongodb://localhost:27017/aumo'),
  
  // JWT Secrets (MUST be set in production)
  JWT_SECRET: z.string().default('aumo-jwt-secret-key-change-in-production'),
  JWT_REFRESH_SECRET: z.string().default('aumo-jwt-refresh-secret-key-change-in-production'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // External Services
  AI_SERVICE_URL: z.string().default('http://localhost:8000'),
  OSRM_URL: z.string().default('http://localhost:5001'),
  
  // Email Configuration
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.string().default('587'),
  SMTP_USER: z.string().default('noreply@aumo.app'),
  SMTP_PASS: z.string().default('changeme'),
  
  // Admin Credentials
  ADMIN_EMAIL: z.string().default('admin@aumo.app'),
  ADMIN_PASSWORD: z.string().default('Admin123!'),
  
  // CORS - comma-separated origins for production
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  
  // Server
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // API Key for AI service authentication
  AI_API_KEY: z.string().default('aumo-ai-api-key'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

// Helper to parse CORS origins
export const getCorsOrigins = (): string[] => {
  const origins = env.CORS_ORIGIN.split(',').map(o => o.trim());
  return origins;
};

// Check if running in production
export const isProduction = env.NODE_ENV === 'production';

