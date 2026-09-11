import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);
const redis = require('redis');

const prisma = new PrismaClient();
const ANALYTICS_QUEUE = 'analytics_queue';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
let redisClient = null;

async function getRedisClient() {
  if (!redisClient) {
    redisClient = redis.createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => console.error('Redis Analytics Error:', err));
    await redisClient.connect();
    console.log('📊 Analytics Worker connected to Redis');
  }
  return redisClient;
}

/**
 * Starts the RabbitMQ Analytics & Telemetry Event Worker
 * @param {import('amqplib').Connection} connection
 */
export async function startAnalyticsWorker(connection) {
  const channel = await connection.createChannel();
  await channel.assertQueue(ANALYTICS_QUEUE, { durable: true });
  channel.prefetch(10); // Process up to 10 analytics events concurrently

  const rClient = await getRedisClient();

  console.log(`📈 Analytics Worker listening on queue '${ANALYTICS_QUEUE}'...`);

  channel.consume(ANALYTICS_QUEUE, async (msg) => {
    if (!msg) return;

    try {
      const data = JSON.parse(msg.content.toString());
      const { eventType, userId, workspaceId, roomId, metadata, timestamp } = data;

      if (!eventType) {
        console.warn('⚠️ Invalid analytics payload, missing eventType:', data);
        channel.ack(msg);
        return;
      }

      const eventDate = new Date(timestamp || Date.now());
      const dayKey = eventDate.toISOString().slice(0, 10); // YYYY-MM-DD

      // 1. Update Real-time Redis Aggregate Counters & Sorted Sets
      const multi = rClient.multi();

      // Global aggregates
      multi.hIncrBy('analytics:global:totals', eventType, 1);
      multi.hIncrBy('analytics:global:totals', 'TOTAL_EVENTS', 1);
      multi.hIncrBy(`analytics:global:daily:${dayKey}`, eventType, 1);
      multi.expire(`analytics:global:daily:${dayKey}`, 60 * 60 * 24 * 30); // 30 days retention

      // Workspace aggregates
      if (workspaceId) {
        multi.hIncrBy(`analytics:workspace:${workspaceId}:totals`, eventType, 1);
        multi.hIncrBy(`analytics:workspace:${workspaceId}:totals`, 'TOTAL_EVENTS', 1);
        multi.hIncrBy(`analytics:workspace:${workspaceId}:daily:${dayKey}`, eventType, 1);
        multi.expire(`analytics:workspace:${workspaceId}:daily:${dayKey}`, 60 * 60 * 24 * 30);
      }

      // User aggregates
      if (userId) {
        multi.hIncrBy(`analytics:user:${userId}:totals`, eventType, 1);
        multi.hIncrBy(`analytics:user:${userId}:totals`, 'TOTAL_EVENTS', 1);
        multi.hIncrBy(`analytics:user:${userId}:daily:${dayKey}`, eventType, 1);
        multi.expire(`analytics:user:${userId}:daily:${dayKey}`, 60 * 60 * 24 * 30);
      }

      // Room aggregates
      if (roomId) {
        multi.hIncrBy(`analytics:room:${roomId}:totals`, eventType, 1);
      }

      await multi.exec();

      // 2. Persist to PostgreSQL (Audit / Detailed Event Log)
      await prisma.analyticsEvent.create({
        data: {
          eventType,
          userId: userId || null,
          workspaceId: workspaceId || null,
          roomId: roomId || null,
          metadata: metadata || {},
          createdAt: eventDate
        }
      });

      channel.ack(msg);
    } catch (err) {
      console.error('❌ [AnalyticsWorker] Error processing analytics event:', err.message);
      // Ack corrupt/failed events to avoid infinite re-queues
      channel.ack(msg);
    }
  });
}
