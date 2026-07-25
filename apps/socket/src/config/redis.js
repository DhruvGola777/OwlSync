import { createClient } from 'redis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const pubClient = createClient({ url: REDIS_URL });
export const subClient = pubClient.duplicate();

export const connectRedis = async () => {
  try {
    await Promise.all([
      pubClient.connect(),
      subClient.connect()
    ]);
    console.log('✅ Connected to Redis (Socket Server)');
  } catch (err) {
    console.error('❌ Failed to connect to Redis:', err);
  }
};
