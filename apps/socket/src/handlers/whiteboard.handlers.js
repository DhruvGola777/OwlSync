import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const saveTimeouts = new Map();

function scheduleSave(projectId, state) {
  if (saveTimeouts.has(projectId)) {
    clearTimeout(saveTimeouts.get(projectId));
  }
  saveTimeouts.set(projectId, setTimeout(async () => {
    try {
      await prisma.whiteboard.update({
        where: { projectId },
        data: { state: JSON.stringify(state) }
      });
    } catch (err) {
      console.error('Failed to save whiteboard to DB', err);
    }
    saveTimeouts.delete(projectId);
  }, 5000));
}

// We'll store the latest full state in memory for fast joining
const boardStates = new Map();

export const registerWhiteboardHandlers = (io, socket) => {
  socket.on('whiteboard:join', async ({ projectId }) => {
    if (!projectId) return;
    
    socket.join(`whiteboard:${projectId}`);
    
    let state = boardStates.get(projectId);
    if (!state) {
      try {
        let wb = await prisma.whiteboard.findUnique({ where: { projectId }});
        if (!wb) {
           wb = await prisma.whiteboard.create({
             data: {
               projectId,
               state: ''
             }
           });
        }
        if (wb.state) {
          state = JSON.parse(wb.state);
          boardStates.set(projectId, state);
        }
      } catch (err) {
        console.error('Failed to fetch project whiteboard', err);
      }
    }
    
    // Send full state to the joining client
    if (state) {
      socket.emit('whiteboard:sync', { state });
    }
  });

  socket.on('whiteboard:update', ({ projectId, update }) => {
    // Broadcast to others in the room
    socket.to(`whiteboard:${projectId}`).emit('whiteboard:update', { update });
  });

  // Tldraw full state save for persistence (from one of the active clients)
  socket.on('whiteboard:save', ({ projectId, state }) => {
    boardStates.set(projectId, state);
    scheduleSave(projectId, state);
  });
};
