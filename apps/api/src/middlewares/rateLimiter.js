import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient } from '../config/redis.js';

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
