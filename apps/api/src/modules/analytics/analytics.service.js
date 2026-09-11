import { publishToQueue } from '../../config/rabbitmq.js';
import { redisClient } from '../../config/redis.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ANALYTICS_QUEUE = 'analytics_queue';

/**
 * Publishes an asynchronous analytics/telemetry event to RabbitMQ (Fire & Forget)
 * @param {string} eventType e.g., 'FILE_SAVE', 'AI_QUERY', 'ROOM_JOIN', 'EXPORT_ZIP', 'RECORDING_UPLOAD'
 * @param {object} payload { userId, workspaceId, roomId, metadata }
 */
export const trackEvent = async (eventType, { userId = null, workspaceId = null, roomId = null, metadata = {} } = {}) => {
  try {
    const eventPayload = {
      eventType,
      userId,
      workspaceId,
      roomId,
      metadata,
      timestamp: new Date().toISOString()
    };
    
    // Publish to RabbitMQ background queue without blocking the caller
    publishToQueue(ANALYTICS_QUEUE, eventPayload).catch((err) => {
      console.error('[Analytics] Failed to publish event:', err.message);
    });
  } catch (err) {
    console.error('[Analytics] Error tracking event:', err.message);
  }
};

/**
 * Gets aggregated real-time analytics for a user
 * @param {string} userId
 */
export const getUserAnalytics = async (userId) => {
  try {
    // 1. Fetch from Redis real-time hash
    let totals = {};
    if (redisClient && redisClient.isOpen) {
      totals = await redisClient.hGetAll(`analytics:user:${userId}:totals`);
    }

    // 2. Fallback / supplementary query from PostgreSQL if empty
    if (!totals || Object.keys(totals).length === 0) {
      const counts = await prisma.analyticsEvent.groupBy({
        by: ['eventType'],
        where: { userId },
        _count: { eventType: true }
      });

      totals = counts.reduce((acc, curr) => {
        acc[curr.eventType] = curr._count.eventType;
        return acc;
      }, {});
    }

    // Recent activity logs
    const recentEvents = await prisma.analyticsEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    return {
      userId,
      totals: {
        FILE_SAVE: parseInt(totals.FILE_SAVE || '0', 10),
        AI_QUERY: parseInt(totals.AI_QUERY || '0', 10),
        ROOM_JOIN: parseInt(totals.ROOM_JOIN || '0', 10),
        EXPORT_ZIP: parseInt(totals.EXPORT_ZIP || '0', 10),
        RECORDING_UPLOAD: parseInt(totals.RECORDING_UPLOAD || '0', 10),
        TOTAL_EVENTS: parseInt(totals.TOTAL_EVENTS || '0', 10)
      },
      recentEvents
    };
  } catch (err) {
    console.error('[Analytics] Error fetching user analytics:', err.message);
    throw err;
  }
};

/**
 * Gets aggregated real-time analytics for a workspace
 * @param {string} workspaceId
 */
export const getWorkspaceAnalytics = async (workspaceId) => {
  try {
    let totals = {};
    if (redisClient && redisClient.isOpen) {
      totals = await redisClient.hGetAll(`analytics:workspace:${workspaceId}:totals`);
    }

    if (!totals || Object.keys(totals).length === 0) {
      const counts = await prisma.analyticsEvent.groupBy({
        by: ['eventType'],
        where: { workspaceId },
        _count: { eventType: true }
      });

      totals = counts.reduce((acc, curr) => {
        acc[curr.eventType] = curr._count.eventType;
        return acc;
      }, {});
    }

    const recentEvents = await prisma.analyticsEvent.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 15
    });

    return {
      workspaceId,
      totals: {
        FILE_SAVE: parseInt(totals.FILE_SAVE || '0', 10),
        AI_QUERY: parseInt(totals.AI_QUERY || '0', 10),
        ROOM_JOIN: parseInt(totals.ROOM_JOIN || '0', 10),
        EXPORT_ZIP: parseInt(totals.EXPORT_ZIP || '0', 10),
        RECORDING_UPLOAD: parseInt(totals.RECORDING_UPLOAD || '0', 10),
        TOTAL_EVENTS: parseInt(totals.TOTAL_EVENTS || '0', 10)
      },
      recentEvents
    };
  } catch (err) {
    console.error('[Analytics] Error fetching workspace analytics:', err.message);
    throw err;
  }
};
