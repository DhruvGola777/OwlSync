import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const registerRoomHandlers = (io, socket) => {
  socket.on('room:join', async ({ roomId }) => {
    const userId = socket.user?.userId;
    if (!userId) return;

    try {
      // Basic verification: Check if user is a member of this room
      const isMember = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: { roomId, userId },
        },
      });

      if (!isMember) {
        socket.emit('error', { message: 'Not authorized to join this room' });
        return;
      }

      // Join the socket.io room named after the roomId
      socket.join(roomId);

      // Notify others in the room
      socket.to(roomId).emit('room:user_joined', { userId });

      // Send the current list of online users to the joining user
      const sockets = await io.in(roomId).fetchSockets();
      const activeUsers = sockets.map(s => s.user?.userId).filter(Boolean);
      socket.emit('room:active_users', { activeUsers });

    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  socket.on('room:leave', ({ roomId }) => {
    socket.leave(roomId);
    socket.to(roomId).emit('room:user_left', { userId: socket.user?.userId });
  });

  // Handle sudden disconnects
  socket.on('disconnecting', () => {
    const userId = socket.user?.userId;
    // Notify all rooms the user was in
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit('room:user_left', { userId });
      }
    }
  });
};
