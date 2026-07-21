import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const registerChatHandlers = (io, socket) => {
  // Listen for new messages
  socket.on('chat:send_message', async ({ roomId, content }) => {
    const userId = socket.user?.userId;
    if (!userId || !roomId || !content) return;

    try {
      // Save message to database
      const message = await prisma.message.create({
        data: {
          content,
          roomId,
          userId,
        },
        include: {
          user: {
            select: { id: true, username: true, name: true, avatarUrl: true }
          }
        }
      });

      // Broadcast the new message to everyone in the room (including sender, or sender can do optimistic updates)
      // We'll broadcast to the room so everyone gets it. 
      // If we use io.to(roomId), the sender also gets it.
      io.to(roomId).emit('chat:new_message', { message });

    } catch (error) {
      console.error('Error saving/sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Listen for typing events
  socket.on('chat:typing_start', ({ roomId }) => {
    const userId = socket.user?.userId;
    if (!userId || !roomId) return;
    socket.to(roomId).emit('chat:typing_start', { userId });
  });

  socket.on('chat:typing_stop', ({ roomId }) => {
    const userId = socket.user?.userId;
    if (!userId || !roomId) return;
    socket.to(roomId).emit('chat:typing_stop', { userId });
  });
};
