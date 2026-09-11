import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set ffmpeg binary path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const prisma = new PrismaClient();
const THUMBNAIL_QUEUE = 'thumbnail_queue';

// Ensure thumbnails storage folder exists in apps/api/storage/thumbnails
const thumbnailsDir = path.resolve(__dirname, '../../../../apps/api/storage/thumbnails');
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
}

/**
 * Starts the RabbitMQ Thumbnail Generation Worker
 * @param {import('amqplib').Connection} connection
 */
export async function startThumbnailWorker(connection) {
  const channel = await connection.createChannel();
  await channel.assertQueue(THUMBNAIL_QUEUE, { durable: true });
  channel.prefetch(2); // Process up to 2 videos concurrently

  console.log(`📹 Thumbnail Worker listening on queue '${THUMBNAIL_QUEUE}'...`);

  channel.consume(THUMBNAIL_QUEUE, async (msg) => {
    if (!msg) return;

    try {
      const data = JSON.parse(msg.content.toString());
      const { recordingId, filePath } = data;

      if (!recordingId || !filePath) {
        console.warn('⚠️ Invalid thumbnail job payload:', data);
        channel.ack(msg);
        return;
      }

      console.log(`[ThumbnailWorker] Processing video for recording ${recordingId}...`);

      if (!fs.existsSync(filePath)) {
        console.warn(`[ThumbnailWorker] Video file does not exist at '${filePath}'`);
        channel.ack(msg);
        return;
      }

      const thumbnailFilename = `thumb-${recordingId}.jpg`;
      const relativeUrl = `/uploads/thumbnails/${thumbnailFilename}`;

      await new Promise((resolve, reject) => {
        ffmpeg(filePath)
          .screenshots({
            timestamps: ['00:00:01.000'],
            filename: thumbnailFilename,
            folder: thumbnailsDir,
            size: '640x360'
          })
          .on('end', () => {
            console.log(`[ThumbnailWorker] Generated thumbnail: ${thumbnailFilename}`);
            resolve();
          })
          .on('error', (err) => {
            console.error(`[ThumbnailWorker] ffmpeg error for ${recordingId}:`, err.message);
            reject(err);
          });
      });

      // Update database record in PostgreSQL
      await prisma.recording.update({
        where: { id: recordingId },
        data: { thumbnailUrl: relativeUrl }
      });

      console.log(`✅ [ThumbnailWorker] Successfully updated database for recording ${recordingId}`);
      channel.ack(msg);
    } catch (err) {
      console.error('❌ [ThumbnailWorker] Error processing job:', err.message);
      // Reject and do not requeue corrupted video jobs
      channel.ack(msg);
    }
  });
}
