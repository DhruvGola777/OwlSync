import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import { env } from '../config/env.js';

// Create a Redis client for rate limiting
export const redisClient = createClient({
  url: env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
    connectTimeout: 5000
  }
});

redisClient.on('error', (err) => {
  // Graceful log without unhandled crash
  console.warn('Redis Client Notice:', err.message || err);
});

redisClient.connect().catch((err) => {
  console.warn('Redis initial connection deferred:', err.message || err);
});

// Strict rate limiter for authentication endpoints with resilient fallback
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true, // Seamlessly continue if Redis store is temporarily connecting
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes'
  },
  store: new RedisStore({
    sendCommand: async (...args) => {
      if (!redisClient.isOpen) {
        return null;
      }
      try {
        return await redisClient.sendCommand(args);
      } catch (e) {
        return null;
      }
    },
  }),
});
