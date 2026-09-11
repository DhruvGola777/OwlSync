import { redisClient, isRedisReady } from '../config/redis.js';
import AppError from '../utils/AppError.js';

/**
 * Distributed Lock Service (Redlock Pattern)
 * Uses Redis atomic SET NX PX and Lua script evaluation for safe concurrency control.
 */
export class DistributedLockService {
  /**
   * Acquire a distributed lock for a specific resource
   * @param {string} resourceKey - Unique identifier for the locked resource (e.g., 'room:create:user123')
   * @param {number} ttlMs - Lock expiration time in milliseconds (default 5000ms)
   * @param {number} waitTimeoutMs - How long to spin-wait for the lock if already held (default 0ms)
   * @param {number} retryDelayMs - Delay between spin-wait retries (default 50ms)
   * @returns {Promise<{ success: boolean, token: string | null }>}
   */
  static async acquireLock(resourceKey, ttlMs = 5000, waitTimeoutMs = 0, retryDelayMs = 50) {
    const lockKey = `lock:${resourceKey}`;
    const token = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const startTime = Date.now();

    // Fallback gracefully if Redis is offline
    if (!isRedisReady()) {
      console.warn(`[DistributedLock] Redis is offline. Proceeding without lock for '${resourceKey}'`);
      return { success: true, token: `offline-${token}` };
    }

    while (true) {
      try {
        const result = await redisClient.set(lockKey, token, {
          NX: true,
          PX: ttlMs
        });

        if (result === 'OK') {
          return { success: true, token };
        }
      } catch (err) {
        console.warn(`[DistributedLock] Error trying to acquire lock '${resourceKey}':`, err.message);
        return { success: true, token: `error-${token}` };
      }

      // If we don't want to wait or we have exceeded the wait timeout, return failure
      if (waitTimeoutMs <= 0 || (Date.now() - startTime) >= waitTimeoutMs) {
        return { success: false, token: null };
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }

  /**
   * Release a distributed lock safely using an atomic Lua script
   * @param {string} resourceKey 
   * @param {string} token 
   * @returns {Promise<boolean>}
   */
  static async releaseLock(resourceKey, token) {
    if (!token || token.startsWith('offline-') || token.startsWith('error-')) {
      return true;
    }

    if (!isRedisReady()) {
      return true;
    }

    const lockKey = `lock:${resourceKey}`;

    // Atomic release script: Only deletes if the token matches the lock value
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await redisClient.eval(luaScript, {
        keys: [lockKey],
        arguments: [token]
      });
      return result === 1;
    } catch (err) {
      console.warn(`[DistributedLock] Error releasing lock '${resourceKey}':`, err.message);
      return false;
    }
  }

  /**
   * Execute an asynchronous task within a distributed lock
   * @param {string} resourceKey 
   * @param {number} ttlMs 
   * @param {number|Function} waitTimeoutOrFn 
   * @param {Function} [maybeFn] 
   * @returns {Promise<any>}
   */
  static async withLock(resourceKey, ttlMs = 5000, waitTimeoutOrFn = 3000, maybeFn = null) {
    let waitTimeoutMs = 3000;
    let taskFn;

    if (typeof waitTimeoutOrFn === 'function') {
      taskFn = waitTimeoutOrFn;
      waitTimeoutMs = 3000;
    } else {
      waitTimeoutMs = typeof waitTimeoutOrFn === 'number' ? waitTimeoutOrFn : 3000;
      taskFn = maybeFn;
    }

    const { success, token } = await this.acquireLock(resourceKey, ttlMs, waitTimeoutMs);

    if (!success) {
      throw new AppError(
        'Concurrent action detected. This resource is currently locked by another active operation. Please retry.',
        409
      );
    }

    try {
      return await taskFn();
    } finally {
      await this.releaseLock(resourceKey, token);
    }
  }
}

