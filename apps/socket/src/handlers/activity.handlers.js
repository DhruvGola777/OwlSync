export const registerActivityHandlers = (io, socket) => {
  socket.on('project:activity:new', ({ projectId, activity }) => {
    // Broadcast the new activity to all other users in the room
    socket.to(`room:${projectId}`).emit('project:activity', activity);
  });
};
