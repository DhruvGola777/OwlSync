import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional()
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export const magicLinkRequestSchema = z.object({
  email: z.string().email('Invalid email address')
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email('Invalid email address')
});

export const passwordResetSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

export const verifyTwoFactorSchema = z.object({
  token: z.string().min(6, 'Token must be at least 6 characters')
});

export const loginTwoFactorSchema = z.object({
  email: z.string().email('Invalid email address'),
  token: z.string().min(6, 'Token must be at least 6 characters')
});
