import amqp from 'amqplib';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { startEmailWorker } from './workers/email.worker.js';
import { startThumbnailWorker } from './workers/thumbnail.worker.js';
import { startCompressionWorker } from './workers/compression.worker.js';
import { startAnalyticsWorker } from './workers/analytics.worker.js';

// Load .env from root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://127.0.0.1:5672';

async function startWorkers(delay = 3000) {
  let connection;
  let attempt = 1;

  while (!connection) {
    try {
      connection = await amqp.connect(RABBITMQ_URL);
      console.log('✅ Workers app connected to RabbitMQ');
    } catch (error) {
      console.warn(`⏳ Waiting for RabbitMQ to be ready (Attempt ${attempt}): ${error.message}`);
      attempt++;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  connection.on('error', (err) => {
    console.error('⚠️ RabbitMQ Worker connection error:', err.message);
  });

  connection.on('close', () => {
    console.warn('⚠️ RabbitMQ connection closed. Reconnecting workers in 5 seconds...');
    setTimeout(() => startWorkers(delay), 5000);
  });

  try {
    // Start individual workers
    await startEmailWorker(connection);
    await startThumbnailWorker(connection);
    await startCompressionWorker(connection);
    await startAnalyticsWorker(connection);

    console.log('👷 Background workers are running and listening for jobs...');
  } catch (error) {
    console.error('❌ Failed to start specific workers:', error);
  }
}

startWorkers();
