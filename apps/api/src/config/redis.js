import { createClient } from 'redis';
import { env } from './env.js';

/**
 * Centralized Redis Client for OwlSync API
 * Handles connection lifecycle, caching, rate limiting, and distributed locking.
 */
export const redisClient = createClient({
  url: env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (process.env.NODE_ENV === 'test' && retries > 2) {
        return false; // Do not hang tests if Redis is offline
      }
      return Math.min(retries * 50, 2000);
    },
    connectTimeout: 3000
  }
});

redisClient.on('connect', () => {
  console.log('⚡ Redis Client connected successfully');
});

redisClient.on('error', (err) => {
  console.warn('⚠️ Redis Client Notice:', err.message || err);
});

// Auto-connect with graceful unhandled rejection avoidance
redisClient.connect().catch((err) => {
  console.warn('⚠️ Redis initial connection deferred:', err.message || err);
});

export const isRedisReady = () => {
  return redisClient.isOpen && redisClient.isReady;
};
