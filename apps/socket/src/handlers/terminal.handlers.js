import { dockerService } from '../services/docker.service.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const terminalBuffers = new Map(); // socket.id -> string

export const registerTerminalHandlers = (io, socket) => {
  // We expect projectId in all terminal events because terminal is per-project
  // even if they joined a specific room within that project.

  socket.on('terminal:start', async ({ projectId, cols, rows }) => {
    if (!projectId) {
      socket.emit('terminal:error', { error: 'Project ID is required' });
      return;
    }
    
    const userId = socket.user?.userId;
    let user = null;
    if (userId) {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, name: true, avatarUrl: true }
      });
      if (user) {
        dockerService.setActiveUser(projectId, user);
      }
    }

    // Record Terminal Opened activity
    if (user) {
      try {
        const userName = user.name || user.username || 'Someone';
        const activity = await prisma.activity.create({
          data: {
            projectId,
            userId: user.id,
            type: 'TERMINAL_OPEN',
            description: `${userName} opened the terminal`,
            metadata: { projectId }
          },
          include: {
            user: { select: { id: true, username: true, name: true, avatarUrl: true } }
          }
        });

        const rooms = await prisma.room.findMany({ where: { projectId } });
        for (const room of rooms) {
          io.to(room.id).emit('project:activity', activity);
        }
      } catch (actErr) {
        console.error('Failed to log terminal open activity:', actErr);
      }
    }

    await dockerService.attachTerminal(projectId, socket, cols, rows);
  });

  socket.on('terminal:data', async ({ projectId, data }) => {
    if (!projectId) return;
    dockerService.write(projectId, data);

    const userId = socket.user?.userId;
    if (!userId) return;

    // Buffer user keystrokes to detect submitted commands on Enter (\r)
    let buffer = terminalBuffers.get(socket.id) || '';

    if (typeof data === 'string' && (data === '\r' || data === '\n' || data.includes('\r') || data.includes('\n'))) {
      const fullCmd = (buffer + data).replace(/[\r\n]/g, '').trim();
      terminalBuffers.set(socket.id, '');

      if (fullCmd.length > 0) {
        try {
          let user = dockerService.getActiveUser(projectId);
          if (!user || user.id !== userId) {
            user = await prisma.user.findUnique({
              where: { id: userId },
              select: { id: true, username: true, name: true, avatarUrl: true }
            });
            if (user) dockerService.setActiveUser(projectId, user);
          }

          if (user) {
            const userName = user.name || user.username || 'Someone';
            const isCodeRun = fullCmd.startsWith('node ') || fullCmd.startsWith('npm run ') || fullCmd.startsWith('python ') || fullCmd.startsWith('python3 ') || fullCmd.startsWith('bash ') || fullCmd.startsWith('sh ');
            const type = isCodeRun ? 'CODE_EXECUTED' : 'TERMINAL_COMMAND';

            const activity = await prisma.activity.create({
              data: {
                projectId,
                userId: user.id,
                type,
                description: `${userName} executed "${fullCmd}" in terminal`,
                metadata: { command: fullCmd }
              },
              include: {
                user: { select: { id: true, username: true, name: true, avatarUrl: true } }
              }
            });

            const rooms = await prisma.room.findMany({ where: { projectId } });
            for (const room of rooms) {
              io.to(room.id).emit('project:activity', activity);
            }
          }
        } catch (err) {
          console.error('Failed to log terminal command activity:', err);
        }
      }
    } else if (data === '\x7f' || data === '\b') {
      // Handle backspace
      terminalBuffers.set(socket.id, buffer.slice(0, -1));
    } else if (data === '\x03') {
      // Handle Ctrl+C cancel
      terminalBuffers.set(socket.id, '');
    } else if (typeof data === 'string' && !data.startsWith('\x1b')) {
      // Append normal typed characters
      terminalBuffers.set(socket.id, buffer + data);
    }
  });

  socket.on('terminal:resize', async ({ projectId, cols, rows }) => {
    if (!projectId) return;
    await dockerService.resize(projectId, cols, rows);
  });

  socket.on('disconnect', () => {
    terminalBuffers.delete(socket.id);
  });
};
