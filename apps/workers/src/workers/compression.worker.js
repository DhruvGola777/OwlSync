import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const COMPRESSION_QUEUE = 'compression_queue';

// Ensure exports storage folder exists in apps/api/storage/exports
const exportsDir = path.resolve(__dirname, '../../../../apps/api/storage/exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

/**
 * Starts the RabbitMQ Project ZIP Compression Worker
 * @param {import('amqplib').Connection} connection
 */
export async function startCompressionWorker(connection) {
  const channel = await connection.createChannel();
  await channel.assertQueue(COMPRESSION_QUEUE, { durable: true });
  channel.prefetch(3); // Process up to 3 compression jobs concurrently

  console.log(`📦 Compression Worker listening on queue '${COMPRESSION_QUEUE}'...`);

  channel.consume(COMPRESSION_QUEUE, async (msg) => {
    if (!msg) return;

    try {
      const data = JSON.parse(msg.content.toString());
      const { projectId } = data;

      if (!projectId) {
        console.warn('⚠️ Invalid compression job payload:', data);
        channel.ack(msg);
        return;
      }

      console.log(`[CompressionWorker] Starting ZIP compression for project ${projectId}...`);

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { files: true }
      });

      if (!project) {
        console.warn(`[CompressionWorker] Project ${projectId} not found in database`);
        channel.ack(msg);
        return;
      }

      const zipFilename = `project-${projectId}.zip`;
      const zipFilePath = path.join(exportsDir, zipFilename);

      const output = fs.createWriteStream(zipFilePath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      await new Promise((resolve, reject) => {
        output.on('close', () => {
          console.log(`[CompressionWorker] ZIP complete: ${zipFilename} (${archive.pointer()} total bytes)`);
          resolve();
        });

        archive.on('error', (err) => {
          console.error(`[CompressionWorker] Archiver error for project ${projectId}:`, err.message);
          reject(err);
        });

        archive.pipe(output);

        // Add all project files into the archive
        project.files.forEach((file) => {
          // Clean leading slashes from paths (e.g. "/src/App.jsx" -> "src/App.jsx")
          const cleanPath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
          archive.append(file.content || '', { name: cleanPath });
        });

        archive.finalize();
      });

      console.log(`✅ [CompressionWorker] Successfully generated ZIP archive for project ${projectId}`);
      channel.ack(msg);
    } catch (err) {
      console.error('❌ [CompressionWorker] Error processing compression job:', err.message);
      channel.ack(msg);
    }
  });
}
