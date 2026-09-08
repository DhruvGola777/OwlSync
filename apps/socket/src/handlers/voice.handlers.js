/**
 * WebRTC Audio Signaling Handlers for OwlSync Voice Rooms
 */

// In-memory active voice participants map: roomId -> Map(socketId -> userData)
const voiceRooms = new Map();

export const registerVoiceHandlers = (io, socket) => {
  const userId = socket.user?.userId || socket.id;

  // 1. Join Voice Channel
  socket.on('voice:join', ({ roomId, user }) => {
    if (!roomId) return;

    if (!voiceRooms.has(roomId)) {
      voiceRooms.set(roomId, new Map());
    }

    const roomParticipants = voiceRooms.get(roomId);
    
    // Collect existing participants in the voice room (excluding current user)
    const existingUsers = [];
    roomParticipants.forEach((participant, participantSocketId) => {
      existingUsers.push({
        socketId: participantSocketId,
        userId: participant.userId,
        user: participant.user,
        isMuted: participant.isMuted || false,
        isDeafened: participant.isDeafened || false,
        isSpeaking: participant.isSpeaking || false
      });
    });

    // Add current user to room's voice participants
    const currentUserData = {
      socketId: socket.id,
      userId,
      user: user || { id: userId, name: 'Anonymous' },
      isMuted: false,
      isDeafened: false,
      isSpeaking: false,
      joinedAt: new Date()
    };
    roomParticipants.set(socket.id, currentUserData);
    socket.join(`voice:${roomId}`);

    // Return existing users to the joining client so it can create peer offers
    socket.emit('voice:all_users', { users: existingUsers });

    // Notify other peers in the voice room that a new user joined
    socket.to(`voice:${roomId}`).emit('voice:user_joined', {
      socketId: socket.id,
      userId,
      user: currentUserData.user,
      isMuted: false,
      isDeafened: false,
      isSpeaking: false
    });

    console.log(`[Voice] User ${userId} (${socket.id}) joined voice room: ${roomId}. Total: ${roomParticipants.size}`);
  });

  // 2. WebRTC Peer Signaling (Offer / Answer / ICE Candidate exchange)
  socket.on('voice:signal', ({ toSocketId, signal }) => {
    if (!toSocketId || !signal) return;
    io.to(toSocketId).emit('voice:signal', {
      fromSocketId: socket.id,
      fromUserId: userId,
      signal
    });
  });

  // 3. Speaking / Audio Level Indicator
  socket.on('voice:speaking', ({ roomId, isSpeaking }) => {
    if (!roomId) return;
    const roomParticipants = voiceRooms.get(roomId);
    if (roomParticipants && roomParticipants.has(socket.id)) {
      const data = roomParticipants.get(socket.id);
      data.isSpeaking = !!isSpeaking;
    }
    socket.to(`voice:${roomId}`).emit('voice:user_speaking', {
      socketId: socket.id,
      userId,
      isSpeaking: !!isSpeaking
    });
  });

  // 4. Mute / Deafen State Change
  socket.on('voice:state_change', ({ roomId, isMuted, isDeafened }) => {
    if (!roomId) return;
    const roomParticipants = voiceRooms.get(roomId);
    if (roomParticipants && roomParticipants.has(socket.id)) {
      const data = roomParticipants.get(socket.id);
      if (isMuted !== undefined) data.isMuted = isMuted;
      if (isDeafened !== undefined) data.isDeafened = isDeafened;
    }
    socket.to(`voice:${roomId}`).emit('voice:user_state_changed', {
      socketId: socket.id,
      userId,
      isMuted: isMuted !== undefined ? isMuted : false,
      isDeafened: isDeafened !== undefined ? isDeafened : false
    });
  });

  // 5. Host Remote Mute User (Google Meet style)
  socket.on('voice:host_mute_user', ({ targetSocketId, targetUserId }) => {
    if (targetSocketId) {
      io.to(targetSocketId).emit('voice:force_muted', {
        byUserId: userId
      });
    }
  });

  // 6. Leave Voice Channel
  const handleLeaveVoice = (roomId) => {
    if (!roomId) return;
    const roomParticipants = voiceRooms.get(roomId);
    if (roomParticipants && roomParticipants.has(socket.id)) {
      roomParticipants.delete(socket.id);
      if (roomParticipants.size === 0) {
        voiceRooms.delete(roomId);
      }
      socket.leave(`voice:${roomId}`);
      io.to(`voice:${roomId}`).emit('voice:user_left', {
        socketId: socket.id,
        userId
      });
      console.log(`[Voice] User ${userId} (${socket.id}) left voice room: ${roomId}`);
    }
  };

  socket.on('voice:leave', ({ roomId }) => {
    handleLeaveVoice(roomId);
  });

  // Handle sudden disconnects
  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (room.startsWith('voice:')) {
        const roomId = room.replace('voice:', '');
        handleLeaveVoice(roomId);
      }
    }
  });
};
