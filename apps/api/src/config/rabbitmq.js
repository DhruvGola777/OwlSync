import amqp from 'amqplib';
import { env } from './env.js';

let connection = null;
let channel = null;

export const connectRabbitMQ = async (retries = 5, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      connection = await amqp.connect(env.RABBITMQ_URL);
      channel = await connection.createChannel();
      console.log('✅ Connected to RabbitMQ (API)');
      return;
    } catch (error) {
      console.error(`❌ Failed to connect to RabbitMQ (Attempt ${i + 1}/${retries}):`, error.message);
      if (i < retries - 1) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  console.error('❌ Could not connect to RabbitMQ after multiple attempts.');
};

export const getChannel = () => {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized');
  }
  return channel;
};

export const publishToQueue = async (queueName, data) => {
  try {
    if (!channel) {
      await connectRabbitMQ();
    }
    await channel.assertQueue(queueName, { durable: true });
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(data)), {
      persistent: true,
    });
    console.log(`📤 Published message to queue: ${queueName}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to publish to queue ${queueName}:`, error);
    return false;
  }
};
