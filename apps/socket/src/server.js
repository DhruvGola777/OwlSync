import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireSocketAuth } from './middlewares/auth.js';
import { registerRoomHandlers } from './handlers/room.handlers.js';

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

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user?.userId} (Socket: ${socket.id})`);

  // Register Handlers
  registerRoomHandlers(io, socket);

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user?.userId} (Socket: ${socket.id})`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`🔌 Socket Server running on http://localhost:${PORT}`);
});
