import { DistributedLockService } from '../src/services/distributedLock.service.js';
import { redisClient, isRedisReady } from '../src/config/redis.js';

describe('Redis Distributed Lock Unit Tests', () => {
  const lockKey = 'test:resource:lock:123';

  afterAll(async () => {
    if (isRedisReady()) {
      await redisClient.del(`lock:${lockKey}`);
    }
  });

  it('should acquire and safely release a distributed lock', async () => {
    if (!isRedisReady()) {
      console.warn('Redis not running, fallback lock active');
    }

    const { success, token } = await DistributedLockService.acquireLock(lockKey, 5000, 0);
    expect(success).toBe(true);
    expect(token).toBeDefined();

    if (isRedisReady()) {
      // Attempting to acquire again immediately should fail
      const secondAttempt = await DistributedLockService.acquireLock(lockKey, 5000, 0);
      expect(secondAttempt.success).toBe(false);

      // Release the lock
      const released = await DistributedLockService.releaseLock(lockKey, token);
      expect(released).toBe(true);

      // Now acquiring should succeed again
      const thirdAttempt = await DistributedLockService.acquireLock(lockKey, 5000, 0);
      expect(thirdAttempt.success).toBe(true);
      await DistributedLockService.releaseLock(lockKey, thirdAttempt.token);
    }
  });

  it('withLock helper should execute callback inside lock and release automatically', async () => {
    let executed = false;
    const result = await DistributedLockService.withLock('test:lock:helper', 5000, async () => {
      executed = true;
      return 'success_result';
    });

    expect(executed).toBe(true);
    expect(result).toBe('success_result');
  });
});
