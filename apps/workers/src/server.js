import amqp from 'amqplib';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { startEmailWorker } from './workers/email.worker.js';

// Load .env from root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://127.0.0.1:5672';

async function startWorkers(retries = 10, delay = 5000) {
  let connection;
  for (let i = 0; i < retries; i++) {
    try {
      connection = await amqp.connect(RABBITMQ_URL);
      console.log('✅ Workers app connected to RabbitMQ');
      break;
    } catch (error) {
      console.error(`❌ Failed to connect workers to RabbitMQ (Attempt ${i + 1}/${retries}):`, error.message);
      if (i < retries - 1) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        process.exit(1);
      }
    }
  }

  try {
    // Start individual workers
    await startEmailWorker(connection);

    console.log('👷 Background workers are running and listening for jobs...');
  } catch (error) {
    console.error('❌ Failed to start specific workers:', error);
    process.exit(1);
  }
}

startWorkers();
