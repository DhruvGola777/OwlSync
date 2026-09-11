import { PrismaClient } from '@prisma/client';
import { CacheService } from '../../services/cache.service.js';

const prisma = new PrismaClient();

/**
 * Global search across Projects, Rooms, Users, and Files
 * @param {string} query - The search query string
 * @param {string} currentUserId - The authenticated user ID
 * @returns {Promise<{ projects: Array, rooms: Array, users: Array, files: Array }>}
 */
export const performGlobalSearch = async (query, currentUserId) => {
  const trimmed = (query || '').trim();
  if (!trimmed || trimmed.length < 2) {
    return { projects: [], rooms: [], users: [], files: [] };
  }

  const cacheKey = `search:${currentUserId}:${trimmed.toLowerCase()}`;

  return CacheService.getOrSet(cacheKey, 30, async () => {
    const [projects, rooms, users, files] = await Promise.all([
      // 1. Projects owned by user matching query
      prisma.project.findMany({
        where: {
          ownerId: currentUserId,
          OR: [
            { name: { contains: trimmed, mode: 'insensitive' } },
            { description: { contains: trimmed, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          name: true,
          description: true,
          updatedAt: true
        },
        take: 6,
        orderBy: { updatedAt: 'desc' }
      }),

      // 2. Rooms accessible or matching query
      prisma.room.findMany({
        where: {
          OR: [
            { name: { contains: trimmed, mode: 'insensitive' } },
            { description: { contains: trimmed, mode: 'insensitive' } },
            { language: { contains: trimmed, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          name: true,
          description: true,
          language: true,
          owner: {
            select: { id: true, username: true, name: true, avatarUrl: true }
          }
        },
        take: 6,
        orderBy: { updatedAt: 'desc' }
      }),

      // 3. Users matching username or name
      prisma.user.findMany({
        where: {
          id: { not: currentUserId },
          OR: [
            { username: { contains: trimmed, mode: 'insensitive' } },
            { name: { contains: trimmed, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          username: true,
          name: true,
          avatarUrl: true,
          bio: true,
          status: true
        },
        take: 6
      }),

      // 4. Files in projects owned by user
      prisma.file.findMany({
        where: {
          project: {
            ownerId: currentUserId
          },
          OR: [
            { name: { contains: trimmed, mode: 'insensitive' } },
            { path: { contains: trimmed, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          name: true,
          path: true,
          projectId: true,
          project: {
            select: { id: true, name: true }
          }
        },
        take: 8
      })
    ]);

    return { projects, rooms, users, files };
  });
};
