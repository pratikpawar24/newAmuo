import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { User } from '../models/User';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { logger } from '../utils/logger';

const registerSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().optional().default(''),
  password: z.string().min(6).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const IS_PROD = process.env.NODE_ENV === 'production';
const COOKIE_OPTS_ACCESS = { httpOnly: true, secure: IS_PROD, maxAge: 15 * 60 * 1000, sameSite: (IS_PROD ? 'none' : 'lax') as 'none' | 'lax', path: '/' };
const COOKIE_OPTS_REFRESH = { httpOnly: true, secure: IS_PROD, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: (IS_PROD ? 'none' : 'lax') as 'none' | 'lax', path: '/' };

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', message: parsed.error.errors.map(e => e.message).join(', ') });
      return;
    }

    const { fullName, email, phone, password } = parsed.data;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ success: false, error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const avatarUrl = `https://www.gravatar.com/avatar/${Buffer.from(email.toLowerCase()).toString('hex')}?d=identicon`;

    const user = await User.create({ fullName, email: email.toLowerCase(), phone, passwordHash, avatarUrl });

    const payload = { userId: user._id.toString(), email: user.email, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    user.refreshTokens.push(refreshToken);
    await user.save();

    res.cookie('accessToken', accessToken, COOKIE_OPTS_ACCESS);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTS_REFRESH);

    res.status(201).json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: { _id: user._id, email: user.email, fullName: user.fullName, role: user.role, avatarUrl: user.avatarUrl, greenScore: user.greenScore, badges: user.badges },
      },
    });
  } catch (error) {
    logger.error('Register error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed' });
      return;
    }

    const { email, password } = parsed.data;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const payload = { userId: user._id.toString(), email: user.email, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    user.refreshTokens.push(refreshToken);
    if (user.refreshTokens.length > 5) user.refreshTokens = user.refreshTokens.slice(-5);
    await user.save();

    res.cookie('accessToken', accessToken, COOKIE_OPTS_ACCESS);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTS_REFRESH);

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: { _id: user._id, email: user.email, fullName: user.fullName, role: user.role, avatarUrl: user.avatarUrl, greenScore: user.greenScore, badges: user.badges, stats: user.stats, preferences: user.preferences },
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const token = req.cookies?.refreshToken || req.body.refreshToken;
    if (!token) {
      res.status(401).json({ success: false, error: 'Refresh token required' });
      return;
    }

    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.userId);
    if (!user || !user.refreshTokens.includes(token)) {
      res.status(401).json({ success: false, error: 'Invalid refresh token' });
      return;
    }

    // Rotate: remove old, add new
    user.refreshTokens = user.refreshTokens.filter((t: string) => t !== token);
    const payload = { userId: user._id.toString(), email: user.email, role: user.role };
    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload);
    user.refreshTokens.push(newRefreshToken);
    await user.save();

    res.cookie('accessToken', newAccessToken, COOKIE_OPTS_ACCESS);
    res.cookie('refreshToken', newRefreshToken, COOKIE_OPTS_REFRESH);

    res.json({ success: true, data: { accessToken: newAccessToken, refreshToken: newRefreshToken } });
  } catch {
    res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const token = req.cookies?.refreshToken || req.body.refreshToken;
    if (token && req.user) {
      await User.findByIdAndUpdate(req.user.userId, { $pull: { refreshTokens: token } });
    }
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    res.json({ success: true, message: 'Logged out' });
  } catch {
    res.json({ success: true, message: 'Logged out' });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Not authenticated' }); return; }
    const user = await User.findById(req.user.userId).select('-passwordHash -refreshTokens');
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('GetMe error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
}
