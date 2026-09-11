import * as Y from 'yjs';
import { PrismaClient } from '@prisma/client';
import { dockerService } from '../services/docker.service.js';

const prisma = new PrismaClient();
const docs = new Map();
const saveTimeouts = new Map();

function scheduleSave(roomId, doc) {
  if (saveTimeouts.has(roomId)) {
    clearTimeout(saveTimeouts.get(roomId));
  }
  saveTimeouts.set(roomId, setTimeout(async () => {
    try {
      const room = await prisma.room.findUnique({ 
        where: { id: roomId }, 
        include: { project: { include: { files: true } } }
      });
      
      if (room && room.project) {
        const projectId = room.project.id;
        let container = null;
        try {
           container = await dockerService.getOrCreateContainer(projectId);
        } catch (e) {
           // Container might not be running, that's fine
        }

        const updates = [];
        for (const file of room.project.files) {
          const textType = doc.getText(file.id);
          if (textType) {
            const content = textType.toString();
            // Only update if content changed? Yjs getText will return the current content
            // We just blind update for MVP
            updates.push(
              prisma.file.update({
                where: { id: file.id },
                data: { content }
              })
            );

            if (container) {
               await dockerService.writeToContainerFile(container, file.path, content).catch(console.error);
            }
          }
        }
        
        if (updates.length > 0) {
           await prisma.$transaction(updates);
        }
      } else {
        // Legacy single-file mode
        const code = doc.getText('monaco').toString();
        await prisma.room.update({
          where: { id: roomId },
          data: { code }
        });
      }
    } catch (err) {
      console.error('Failed to save code to DB', err);
    }
    saveTimeouts.delete(roomId);
  }, 3000));
}

export const registerEditorHandlers = (io, socket) => {
  socket.on('editor:join', async ({ roomId }) => {
    socket.join(`editor:${roomId}`);
    
    let doc = docs.get(roomId);
    if (!doc) {
      doc = new Y.Doc();
      docs.set(roomId, doc);
      try {
        // Fetch initial code from DB
        const room = await prisma.room.findUnique({ 
          where: { id: roomId },
          include: { project: { include: { files: true } } }
        });
        
        if (room) {
          if (room.project) {
            // Load all files into Yjs doc
            room.project.files.forEach(file => {
              if (file.content) {
                doc.getText(file.id).insert(0, file.content);
              }
            });
          } else if (room.code) {
            // Legacy single file
            doc.getText('monaco').insert(0, room.code);
          }
        }
      } catch (err) {
        console.error('Failed to fetch room code for editor', err);
      }
    }
    
    // Send full state to the joining client
    const state = Y.encodeStateAsUpdate(doc);
    socket.emit('editor:sync', { update: Array.from(state) });
  });

  socket.on('editor:update', async ({ roomId, update }) => {
    const userId = socket.user?.userId;
    if (userId) {
      try {
        const member = await prisma.roomMember.findUnique({
          where: { roomId_userId: { roomId, userId } }
        });
        if (member && member.role === 'GUEST') {
          // Read-only user, drop update
          return socket.emit('editor:error', { message: 'You have read-only access in this room' });
        }
      } catch (err) {}
    }

    const doc = docs.get(roomId);
    if (doc) {
      try {
        const updateArray = new Uint8Array(update);
        Y.applyUpdate(doc, updateArray);
        // Broadcast to others in the room
        socket.to(`editor:${roomId}`).emit('editor:update', { update });
        
        // Debounce saving to DB
        scheduleSave(roomId, doc);
      } catch (err) {
        console.error('Error applying Yjs update', err);
      }
    }
  });

  socket.on('editor:language_change', ({ roomId, language }) => {
     socket.to(`editor:${roomId}`).emit('editor:language_change', { language });
     prisma.room.update({ where: { id: roomId }, data: { language }}).catch(console.error);
  });

  socket.on('editor:awareness', ({ roomId, update }) => {
    socket.to(`editor:${roomId}`).emit('editor:awareness', { update });
  });

  socket.on('editor:request_awareness', ({ roomId }) => {
    socket.to(`editor:${roomId}`).emit('editor:request_awareness');
  });
};
