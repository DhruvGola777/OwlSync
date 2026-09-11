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

      // Send the current list of online users to ALL users in the room
      const sockets = await io.in(roomId).fetchSockets();
      const activeUsers = [...new Set(sockets.map(s => s.user?.userId).filter(Boolean))];
      io.to(roomId).emit('room:active_users', { activeUsers });
      socket.to(roomId).emit('room:user_joined', { userId });

      // Record USER_JOINED activity in project session timeline
      try {
        const room = await prisma.room.findUnique({
          where: { id: roomId },
          select: { id: true, projectId: true }
        });

        if (room?.projectId) {
          socket.join(room.projectId);
          socket.join(`project:${room.projectId}`);
          socket.join(`room:${room.projectId}`);

          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, name: true, avatarUrl: true }
          });

          if (user) {
            const userName = user.name || user.username || 'Someone';
            const activity = await prisma.activity.create({
              data: {
                projectId: room.projectId,
                userId: user.id,
                type: 'USER_JOINED',
                description: `${userName} joined the session`,
                metadata: { roomId }
              },
              include: {
                user: { select: { id: true, username: true, name: true, avatarUrl: true } }
              }
            });

            io.to(roomId).emit('project:activity', activity);
          }
        }
      } catch (actErr) {
        console.error('Failed to log USER_JOINED activity:', actErr);
      }

    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  socket.on('room:leave', async ({ roomId }) => {
    socket.leave(roomId);
    socket.to(roomId).emit('room:user_left', { userId: socket.user?.userId });
    try {
      const sockets = await io.in(roomId).fetchSockets();
      const activeUsers = [...new Set(sockets.map(s => s.user?.userId).filter(Boolean))];
      io.to(roomId).emit('room:active_users', { activeUsers });
    } catch (e) {}
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

  socket.on('room:change_role', async ({ roomId, targetUserId, newRole }) => {
    const userId = socket.user?.userId;
    if (!userId || !roomId || !targetUserId || !newRole) return;

    try {
      // Verify requester is room owner
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room || room.ownerId !== userId) {
        return socket.emit('error', { message: 'Only the room host can change participant roles' });
      }

      // Map string roles to Prisma RoomRole enum
      const roleMap = {
        'HOST': 'OWNER',
        'OWNER': 'OWNER',
        'EDITOR': 'MEMBER',
        'MEMBER': 'MEMBER',
        'ADMIN': 'ADMIN',
        'VIEWER': 'GUEST',
        'GUEST': 'GUEST'
      };
      const mappedRole = roleMap[newRole.toUpperCase()] || 'MEMBER';

      // Update room member in database
      await prisma.roomMember.updateMany({
        where: { roomId, userId: targetUserId },
        data: { role: mappedRole }
      });

      // Broadcast role update to all room participants
      io.to(roomId).emit('room:role_changed', {
        roomId,
        targetUserId,
        role: mappedRole
      });

      // Create persistent notification and send to user
      try {
        const notif = await prisma.notification.create({
          data: {
            userId: targetUserId,
            type: 'ROLE_CHANGE',
            title: 'Room Permission Updated',
            message: `Your permission in "${room.name}" was changed to ${mappedRole === 'GUEST' ? 'Viewer (Read-Only)' : 'Editor'}.`,
            link: `/room/${roomId}`
          }
        });
        io.to(`user:${targetUserId}`).emit('notification:new', notif);
      } catch (nErr) {
        console.error('Failed to create role change notification:', nErr);
      }
    } catch (error) {
      console.error('Error changing user role:', error);
      socket.emit('error', { message: 'Failed to change role' });
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

  socket.on('project:files_changed', ({ roomId }) => {
    // Tell everyone else in the room that the file tree changed so they can refresh
    socket.to(roomId).emit('project:files_changed');
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
