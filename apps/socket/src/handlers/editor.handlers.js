import * as Y from 'yjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const docs = new Map();
const saveTimeouts = new Map();

function scheduleSave(roomId, doc) {
  if (saveTimeouts.has(roomId)) {
    clearTimeout(saveTimeouts.get(roomId));
  }
  saveTimeouts.set(roomId, setTimeout(() => {
    const code = doc.getText('monaco').toString();
    prisma.room.update({
      where: { id: roomId },
      data: { code }
    }).catch(err => console.error('Failed to save code to DB', err));
    saveTimeouts.delete(roomId);
  }, 5000));
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
        const room = await prisma.room.findUnique({ where: { id: roomId }});
        if (room && room.code) {
          doc.getText('monaco').insert(0, room.code);
        }
      } catch (err) {
        console.error('Failed to fetch room code for editor', err);
      }
    }
    
    // Send full state to the joining client
    const state = Y.encodeStateAsUpdate(doc);
    socket.emit('editor:sync', { update: Array.from(state) });
  });

  socket.on('editor:update', ({ roomId, update }) => {
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
};
