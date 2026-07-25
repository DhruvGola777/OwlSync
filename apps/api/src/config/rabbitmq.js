import amqp from 'amqplib';
import { env } from './env.js';

let connection = null;
let channel = null;

export const connectRabbitMQ = async () => {
  try {
    connection = await amqp.connect(env.RABBITMQ_URL);
    channel = await connection.createChannel();
    console.log('✅ Connected to RabbitMQ (API)');
  } catch (error) {
    console.error('❌ Failed to connect to RabbitMQ:', error);
  }
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
