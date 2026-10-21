import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireSocketAuth } from './middlewares/auth.js';
import { registerRoomHandlers } from './handlers/room.handlers.js';
import { registerChatHandlers } from './handlers/chat.handlers.js';
import { registerEditorHandlers } from './handlers/editor.handlers.js';
import { registerNotesHandlers } from './handlers/notes.handlers.js';
import { registerWhiteboardHandlers } from './handlers/whiteboard.handlers.js';
import { registerActivityHandlers } from './handlers/activity.handlers.js';
import { registerTerminalHandlers } from './handlers/terminal.handlers.js';
import { registerVoiceHandlers } from './handlers/voice.handlers.js';
import { dockerService } from './services/docker.service.js';
import { PrismaClient } from '@prisma/client';
import { createAdapter } from '@socket.io/redis-adapter';
import { connectRedis, pubClient, subClient } from './config/redis.js';

const prisma = new PrismaClient();

// Load .env from root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const PORT = process.env.SOCKET_PORT || 4001;

export const initSocketServer = async (httpServer) => {
  let isRedisReady = false;
  try {
    await connectRedis();
    if (pubClient.isOpen && subClient.isOpen) {
      isRedisReady = true;
    }
  } catch (redisErr) {
    console.warn('⚠️ Redis connection skipped/unavailable, running with in-memory adapter:', redisErr.message);
  }

  const ioConfig = {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  };

  if (isRedisReady) {
    try {
      ioConfig.adapter = createAdapter(pubClient, subClient);
      console.log('✅ Socket.IO Redis adapter enabled');
    } catch (e) {
      console.warn('⚠️ Could not attach Redis adapter, defaulting to in-memory:', e.message);
    }
  }

  const io = new Server(httpServer, ioConfig);
  dockerService.setIo(io);

  // Middleware
  io.use(requireSocketAuth);

  io.on('connection', async (socket) => {
    const userId = socket.user?.userId;
    console.log(`User connected: ${userId} (Socket: ${socket.id})`);

    if (userId) {
      socket.join(`user:${userId}`);
      try {
        if (pubClient.isOpen) {
          await pubClient.set(`user:${userId}:status`, 'ONLINE').catch(() => {});
        }
        
        await prisma.user.update({
          where: { id: userId },
          data: { status: 'ONLINE', lastSeen: new Date() }
        }).catch(() => {});
        
        io.emit('user:status_change', { userId, status: 'ONLINE' });
      } catch (err) {
        console.error('Failed to update user status to ONLINE', err);
      }
    }

    // Register Handlers
    registerRoomHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerEditorHandlers(io, socket);
    registerNotesHandlers(io, socket);
    registerWhiteboardHandlers(io, socket);
    registerActivityHandlers(io, socket);
    registerTerminalHandlers(io, socket);
    registerVoiceHandlers(io, socket);

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${userId} (Socket: ${socket.id})`);
      if (userId) {
        try {
          const sockets = await io.fetchSockets();
          const stillConnected = sockets.some(s => s.user?.userId === userId);

          if (!stillConnected) {
            if (pubClient.isOpen) {
              await pubClient.set(`user:${userId}:status`, 'OFFLINE').catch(() => {});
            }
            
            await prisma.user.update({
              where: { id: userId },
              data: { status: 'OFFLINE', lastSeen: new Date() }
            }).catch(() => {});
            
            io.emit('user:status_change', { userId, status: 'OFFLINE', lastSeen: new Date() });
          }
        } catch (err) {
          console.error('Failed to update user status to OFFLINE:', err.message);
        }
      }
    });
  });

  return io;
};

// Auto-run if executed directly as main script
const isDirectRun = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(__filename) ||
  process.argv[1].endsWith('server.js')
);

if (isDirectRun && !process.env.OWLSYNC_EMBEDDED_SOCKET) {
  const httpServer = createServer();
  initSocketServer(httpServer).then(() => {
    httpServer.listen(PORT, () => {
      console.log(`🔌 Standalone Socket Server running on http://localhost:${PORT}`);
    });
  });
}
