import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireSocketAuth } from './middlewares/auth.js';
import { registerRoomHandlers } from './handlers/room.handlers.js';
import { registerChatHandlers } from './handlers/chat.handlers.js';
import { registerEditorHandlers } from './handlers/editor.handlers.js';
import { PrismaClient } from '@prisma/client';

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
});

// Middleware
io.use(requireSocketAuth);

io.on('connection', async (socket) => {
  const userId = socket.user?.userId;
  console.log(`User connected: ${userId} (Socket: ${socket.id})`);

  if (userId) {
    try {
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

  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${userId} (Socket: ${socket.id})`);
    if (userId) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { status: 'OFFLINE', lastSeen: new Date() }
        });
        io.emit('user:status_change', { userId, status: 'OFFLINE', lastSeen: new Date() });
      } catch (err) {
        console.error('Failed to update user status to OFFLINE', err);
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`🔌 Socket Server running on http://localhost:${PORT}`);
});
