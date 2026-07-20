import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z.string().min(2, 'Room name must be at least 2 characters'),
  description: z.string().optional(),
  password: z.string().min(4, 'Password must be at least 4 characters').optional().or(z.literal(''))
});

export const joinRoomSchema = z.object({
  roomId: z.string().min(1, 'Room ID is required'),
  password: z.string().optional().or(z.literal(''))
});

export const updateRoomSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional()
});
