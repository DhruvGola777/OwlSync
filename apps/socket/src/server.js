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

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  adapter: createAdapter(pubClient, subClient),
});

dockerService.setIo(io);

// Middleware
io.use(requireSocketAuth);

io.on('connection', async (socket) => {
  const userId = socket.user?.userId;
  console.log(`User connected: ${userId} (Socket: ${socket.id})`);

  if (userId) {
    try {
      // 1. Fast path: Track online status in Redis
      await pubClient.set(`user:${userId}:status`, 'ONLINE');
      
      // 2. Persistent path: Update last seen in DB
      await prisma.user.update({
        where: { id: userId },
        data: { status: 'ONLINE', lastSeen: new Date() }
      });
      
      // Emit a global event if we want to notify others instantly
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
          await pubClient.set(`user:${userId}:status`, 'OFFLINE').catch(() => {});
          
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

const startServer = async () => {
  await connectRedis();
  
  httpServer.listen(PORT, () => {
    console.log(`🔌 Socket Server running on http://localhost:${PORT}`);
  });
};

startServer();
