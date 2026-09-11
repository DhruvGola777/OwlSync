import { redisClient, isRedisReady } from '../config/redis.js';

/**
 * High-Performance Redis Caching Service
 * Provides Cache-Aside pattern, TTL expiration, and pattern-based cache invalidation.
 */
export class CacheService {
  static PREFIX = 'cache:';

  /**
   * Format full redis cache key
   */
  static _getKey(key) {
    return `${this.PREFIX}${key}`;
  }

  /**
   * Get cached data by key
   * @param {string} key 
   * @returns {Promise<any | null>}
   */
  static async get(key) {
    if (!isRedisReady()) return null;

    try {
      const data = await redisClient.get(this._getKey(key));
      if (!data) return null;
      return JSON.parse(data);
    } catch (err) {
      console.warn(`[CacheService] Failed to read key '${key}':`, err.message);
      return null;
    }
  }

  /**
   * Set cached data with TTL expiration
   * @param {string} key 
   * @param {any} value 
   * @param {number} ttlSeconds - Default 60 seconds
   * @returns {Promise<boolean>}
   */
  static async set(key, value, ttlSeconds = 60) {
    if (!isRedisReady() || value === undefined) return false;

    try {
      const serialized = JSON.stringify(value);
      await redisClient.set(this._getKey(key), serialized, {
        EX: ttlSeconds
      });
      return true;
    } catch (err) {
      console.warn(`[CacheService] Failed to set key '${key}':`, err.message);
      return false;
    }
  }

  /**
   * Delete a specific cache key
   * @param {string} key 
   * @returns {Promise<boolean>}
   */
  static async del(key) {
    if (!isRedisReady()) return false;

    try {
      await redisClient.del(this._getKey(key));
      return true;
    } catch (err) {
      console.warn(`[CacheService] Failed to delete key '${key}':`, err.message);
      return false;
    }
  }

  /**
   * Invalidate multiple keys matching a wildcard pattern (e.g., 'project:123:*')
   * Uses non-blocking SCAN instead of KEYS for production safety.
   * @param {string} pattern 
   * @returns {Promise<number>} Number of keys removed
   */
  static async invalidatePattern(pattern) {
    if (!isRedisReady()) return 0;

    const fullPattern = this._getKey(pattern);
    let cursor = 0;
    let deletedCount = 0;

    try {
      do {
        const reply = await redisClient.scan(cursor, {
          MATCH: fullPattern,
          COUNT: 50
        });

        cursor = reply.cursor;
        const keys = reply.keys;

        if (keys && keys.length > 0) {
          await redisClient.del(keys);
          deletedCount += keys.length;
        }
      } while (cursor !== 0);

      return deletedCount;
    } catch (err) {
      console.warn(`[CacheService] Failed to invalidate pattern '${pattern}':`, err.message);
      return 0;
    }
  }

  /**
   * Cache-Aside Helper: Returns cached data if available, otherwise executes fetchFn and caches result.
   * @param {string} key 
   * @param {number} ttlSeconds 
   * @param {Function} fetchFn 
   * @returns {Promise<any>}
   */
  static async getOrSet(key, ttlSeconds, fetchFn) {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    const freshData = await fetchFn();
    if (freshData !== undefined && freshData !== null) {
      await this.set(key, freshData, ttlSeconds);
    }

    return freshData;
  }
}
