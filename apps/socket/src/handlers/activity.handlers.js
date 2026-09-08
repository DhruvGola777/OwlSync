import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const registerActivityHandlers = (io, socket) => {
  socket.on('project:activity:new', async ({ projectId, activity }) => {
    if (!projectId || !activity) return;
    try {
      socket.to(projectId).emit('project:activity', activity);
      socket.to(`room:${projectId}`).emit('project:activity', activity);

      const rooms = await prisma.room.findMany({
        where: { projectId },
        select: { id: true }
      });
      for (const room of rooms) {
        socket.to(room.id).emit('project:activity', activity);
      }
    } catch (err) {
      console.error('Error broadcasting activity:', err);
    }
  });
};
