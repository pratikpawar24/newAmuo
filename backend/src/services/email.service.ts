import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: parseInt(env.SMTP_PORT, 10),
  secure: false,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: `"AUMO v2" <${env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    logger.info(`Email sent to ${to}: ${subject}`);
    return true;
  } catch (error: unknown) {
    logger.error('Email send error:', error instanceof Error ? error.message : error);
    return false;
  }
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  const resetUrl = `http://localhost:3000/reset-password?token=${token}`;
  return sendEmail(
    email,
    'AUMO v2 - Password Reset',
    `<h1>Password Reset</h1><p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`
  );
}

export async function sendBookingNotification(email: string, rideName: string): Promise<boolean> {
  return sendEmail(
    email,
    'AUMO v2 - New Booking Request',
    `<h1>New Booking Request</h1><p>You have a new booking request for your ride: ${rideName}</p>`
  );
}
