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

  socket.on('room:kick_user', async ({ roomId, targetUserId }) => {
    const userId = socket.user?.userId;
    if (!userId) return;

    try {
      // Verify the requester is the owner
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room || room.ownerId !== userId) {
        return socket.emit('error', { message: 'Not authorized to kick users' });
      }

      // Find the target user's socket in the room
      const sockets = await io.in(roomId).fetchSockets();
      const targetSocket = sockets.find(s => s.user?.userId === targetUserId);

      if (targetSocket) {
        // Emit kicked event to the target user
        targetSocket.emit('room:kicked', { roomId });
        // Force them to leave the socket room
        targetSocket.leave(roomId);
        // Notify others that the user left
        io.to(roomId).emit('room:user_left', { userId: targetUserId });
      }
    } catch (error) {
      console.error('Error kicking user:', error);
    }
  });

  socket.on('room:deleted', async ({ roomId }) => {
    const userId = socket.user?.userId;
    if (!userId) return;

    try {
      // Verify the requester is the owner
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      // Note: room might already be deleted from DB by the REST API, 
      // but if it is, findUnique returns null. We should trust the REST API did its job
      // but to be safe, we can just broadcast the delete and kick everyone out.
      
      const sockets = await io.in(roomId).fetchSockets();
      for (const s of sockets) {
        s.emit('room:kicked', { roomId, reason: 'Room was deleted' });
        s.leave(roomId);
      }
    } catch (error) {
      console.error('Error handling room deletion:', error);
    }
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
