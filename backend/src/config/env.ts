import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  MONGODB_URI: z.string().default('mongodb://localhost:27017/aumo'),
  JWT_SECRET: z.string().default('aumo-jwt-secret-key-change-in-production'),
  JWT_REFRESH_SECRET: z.string().default('aumo-jwt-refresh-secret-key-change-in-production'),
  AI_SERVICE_URL: z.string().default('http://localhost:8000'),
  OSRM_URL: z.string().default('http://localhost:5001'),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.string().default('587'),
  SMTP_USER: z.string().default('noreply@aumo.app'),
  SMTP_PASS: z.string().default('changeme'),
  ADMIN_EMAIL: z.string().default('admin@aumo.app'),
  ADMIN_PASSWORD: z.string().default('Admin123!'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
