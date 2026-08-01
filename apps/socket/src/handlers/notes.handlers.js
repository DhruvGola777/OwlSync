import * as Y from 'yjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const docs = new Map();
const saveTimeouts = new Map();

function scheduleSave(projectId, doc) {
  if (saveTimeouts.has(projectId)) {
    clearTimeout(saveTimeouts.get(projectId));
  }
  saveTimeouts.set(projectId, setTimeout(async () => {
    const content = doc.getText('monaco').toString();
    try {
      await prisma.note.update({
        where: { projectId },
        data: { content }
      });
    } catch (err) {
      console.error('Failed to save notes to DB', err);
    }
    saveTimeouts.delete(projectId);
  }, 5000));
}

export const registerNotesHandlers = (io, socket) => {
  socket.on('notes:join', async ({ projectId }) => {
    if (!projectId) return;
    
    socket.join(`notes:${projectId}`);
    
    let doc = docs.get(projectId);
    if (!doc) {
      doc = new Y.Doc();
      docs.set(projectId, doc);
      try {
        // Fetch initial notes from DB
        let note = await prisma.note.findUnique({ where: { projectId }});
        if (!note) {
           note = await prisma.note.create({
             data: {
               projectId,
               content: '# Project Notes\n\nWelcome to your shared notes. This document synchronizes in real-time.'
             }
           });
        }
        if (note && note.content) {
          doc.getText('monaco').insert(0, note.content);
        }
      } catch (err) {
        console.error('Failed to fetch project notes', err);
      }
    }
    
    // Send full state to the joining client
    const state = Y.encodeStateAsUpdate(doc);
    socket.emit('notes:sync', { update: Array.from(state) });
  });

  socket.on('notes:update', ({ projectId, update }) => {
    const doc = docs.get(projectId);
    if (doc) {
      try {
        const updateArray = new Uint8Array(update);
        Y.applyUpdate(doc, updateArray);
        // Broadcast to others in the room
        socket.to(`notes:${projectId}`).emit('notes:update', { update });
        
        // Debounce saving to DB
        scheduleSave(projectId, doc);
      } catch (err) {
        console.error('Error applying Yjs update for notes', err);
      }
    }
  });

  socket.on('notes:awareness', ({ projectId, update }) => {
    socket.to(`notes:${projectId}`).emit('notes:awareness', { update });
  });

  socket.on('notes:request_awareness', ({ projectId }) => {
    socket.to(`notes:${projectId}`).emit('notes:request_awareness');
  });
};
