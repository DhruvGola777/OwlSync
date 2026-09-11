import { PrismaClient } from '@prisma/client';
import { redisClient } from '../../config/redis.js';
import { getChannel } from '../../config/rabbitmq.js';

const prisma = new PrismaClient();

/**
 * Probes PostgreSQL database with a lightweight query
 */
export const checkPostgres = async () => {
  const start = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Math.round(performance.now() - start);
    return {
      status: 'up',
      latencyMs
    };
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Math.round(performance.now() - start),
      error: err.message
    };
  }
};

/**
 * Probes Redis cache and locking instance
 */
export const checkRedis = async () => {
  const start = performance.now();
  try {
    if (!redisClient || !redisClient.isOpen) {
      return {
        status: 'down',
        latencyMs: Math.round(performance.now() - start),
        error: 'Redis client not connected'
      };
    }
    const pong = await redisClient.ping();
    const latencyMs = Math.round(performance.now() - start);
    return {
      status: pong === 'PONG' ? 'up' : 'degraded',
      latencyMs
    };
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Math.round(performance.now() - start),
      error: err.message
    };
  }
};

/**
 * Probes RabbitMQ message broker channel
 */
export const checkRabbitMQ = async () => {
  const start = performance.now();
  try {
    const channel = getChannel();
    if (!channel) {
      return {
        status: 'down',
        latencyMs: Math.round(performance.now() - start),
        error: 'RabbitMQ channel unavailable'
      };
    }
    return {
      status: 'up',
      latencyMs: Math.round(performance.now() - start)
    };
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Math.round(performance.now() - start),
      error: err.message
    };
  }
};

/**
 * Collects aggregated health diagnostics across all infrastructure services
 */
export const getSystemHealth = async () => {
  const [postgres, redis, rabbitmq] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkRabbitMQ()
  ]);

  const isHealthy = postgres.status === 'up' && redis.status === 'up' && rabbitmq.status === 'up';

  const memoryUsage = process.memoryUsage();
  const memory = {
    heapUsedMB: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
    heapTotalMB: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
    rssMB: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100
  };

  return {
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'owlsync-api',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    services: {
      postgres,
      redis,
      rabbitmq
    },
    system: {
      memory,
      nodeVersion: process.version,
      pid: process.pid
    }
  };
};
