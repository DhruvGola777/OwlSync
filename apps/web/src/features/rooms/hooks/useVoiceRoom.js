import { useState, useEffect, useRef, useCallback } from 'react';
import { socketService } from '../../../services/socket';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export const useVoiceRoom = (roomId, user) => {
  const [inVoice, setInVoice] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceUsers, setVoiceUsers] = useState([]); // Array of { socketId, userId, user, isMuted, isDeafened, isSpeaking }

  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map()); // socketId -> RTCPeerConnection
  const audioElementsRef = useRef(new Map()); // socketId -> HTMLAudioElement
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const isSpeakingRef = useRef(false);

  // Stop local audio tracks and teardown connections
  const cleanup = useCallback(() => {
    // 1. Stop local audio stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // 2. Close peer connections
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();

    // 3. Remove remote audio elements
    audioElementsRef.current.forEach((audioEl) => {
      audioEl.pause();
      audioEl.srcObject = null;
      audioEl.remove();
    });
    audioElementsRef.current.clear();

    // 4. Close audio analysis context
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    setInVoice(false);
    setIsSpeaking(false);
    setVoiceUsers([]);
  }, []);

  // Monitor microphone volume for active speaker detection
  const setupAudioAnalysis = useCallback((stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const microphone = audioCtx.createMediaStreamSource(stream);
      microphone.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const nowSpeaking = average > 18; // Volume threshold

        if (nowSpeaking !== isSpeakingRef.current) {
          isSpeakingRef.current = nowSpeaking;
          setIsSpeaking(nowSpeaking);

          const socket = socketService.getSocket();
          if (socket && roomId) {
            socket.emit('voice:speaking', { roomId, isSpeaking: nowSpeaking });
          }
        }

        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.warn('Audio analyser setup error:', err);
    }
  }, [roomId]);

  // Create an RTCPeerConnection for a target peer socket
  const createPeerConnection = useCallback((targetSocketId, targetUserData, isInitiator) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current.set(targetSocketId, pc);

    // Add local audio tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = socketService.getSocket();
        socket?.emit('voice:signal', {
          toSocketId: targetSocketId,
          signal: { type: 'candidate', candidate: event.candidate }
        });
      }
    };

    // Remote audio track handler
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      let audioEl = audioElementsRef.current.get(targetSocketId);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.playsInline = true;
        document.body.appendChild(audioEl);
        audioElementsRef.current.set(targetSocketId, audioEl);
      }
      audioEl.srcObject = remoteStream;
      audioEl.muted = isDeafened;
    };

    // If this client is the initiator, create and send an SDP offer
    if (isInitiator) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false
          });
          await pc.setLocalDescription(offer);
          const socket = socketService.getSocket();
          socket?.emit('voice:signal', {
            toSocketId: targetSocketId,
            signal: { type: 'offer', sdp: pc.localDescription }
          });
        } catch (err) {
          console.error('Error creating voice offer:', err);
        }
      };
    }

    return pc;
  }, [isDeafened]);

  // Join Voice Channel
  const joinVoice = useCallback(async () => {
    if (!roomId) return;
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
      } catch (constraintErr) {
        // Fallback to basic audio if advanced hardware audio constraints are not supported
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false
        });
      }

      localStreamRef.current = stream;
      setupAudioAnalysis(stream);

      const socket = socketService.getSocket();
      if (!socket) throw new Error('Socket not connected');

      setInVoice(true);
      socket.emit('voice:join', { roomId, user });

    } catch (err) {
      console.error('Failed to access microphone or join voice:', err);
      let msg = err.message || 'Permission denied';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || msg.toLowerCase().includes('permission')) {
        msg = 'Microphone access is blocked. Please allow microphone permission in your browser address bar (click the 🔒 Lock or ⚙️ icon next to the URL) and check Windows Settings > Privacy & security > Microphone.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No microphone hardware found. Please connect a microphone or headset to join the voice channel.';
      }
      alert(msg);
    }
  }, [roomId, user, setupAudioAnalysis]);

  // Leave Voice Channel
  const leaveVoice = useCallback(() => {
    const socket = socketService.getSocket();
    if (socket && roomId) {
      socket.emit('voice:leave', { roomId });
    }
    cleanup();
  }, [roomId, cleanup]);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const newMute = !isMuted;
    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = !newMute;
    });
    setIsMuted(newMute);

    const socket = socketService.getSocket();
    if (socket && roomId) {
      socket.emit('voice:state_change', {
        roomId,
        isMuted: newMute,
        isDeafened
      });
    }
  }, [isMuted, isDeafened, roomId]);

  // Toggle Deafen (mute incoming audio + mute own mic)
  const toggleDeafen = useCallback(() => {
    const newDeafen = !isDeafened;
    setIsDeafened(newDeafen);

    // Mute/unmute all remote audio elements
    audioElementsRef.current.forEach((audioEl) => {
      audioEl.muted = newDeafen;
    });

    // Also mute own microphone when deafened
    if (localStreamRef.current) {
      const shouldMuteMic = newDeafen ? true : isMuted;
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !shouldMuteMic;
      });
      if (newDeafen) setIsMuted(true);
    }

    const socket = socketService.getSocket();
    if (socket && roomId) {
      socket.emit('voice:state_change', {
        roomId,
        isMuted: newDeafen ? true : isMuted,
        isDeafened: newDeafen
      });
    }
  }, [isDeafened, isMuted, roomId]);

  const [mutedPeerSocketIds, setMutedPeerSocketIds] = useState(new Set());

  // Locally Mute/Unmute a specific peer (Google Meet style)
  const toggleMutePeer = useCallback((targetSocketId) => {
    const audioEl = audioElementsRef.current.get(targetSocketId);
    setMutedPeerSocketIds(prev => {
      const updated = new Set(prev);
      if (updated.has(targetSocketId)) {
        updated.delete(targetSocketId);
        if (audioEl) audioEl.muted = false;
      } else {
        updated.add(targetSocketId);
        if (audioEl) audioEl.muted = true;
      }
      return updated;
    });
  }, []);

  // Host Remote Mute a User
  const hostMuteUser = useCallback((targetSocketId, targetUserId) => {
    const socket = socketService.getSocket();
    if (socket && targetSocketId) {
      socket.emit('voice:host_mute_user', { targetSocketId, targetUserId });
    }
  }, []);

  // Handle Socket Events for Voice
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket || !inVoice) return;

    // 1. Received list of all existing users upon joining
    const handleAllUsers = ({ users }) => {
      setVoiceUsers(users || []);
      // As the newly joined peer, initiate offer to each existing user
      (users || []).forEach(existingUser => {
        createPeerConnection(existingUser.socketId, existingUser, true);
      });
    };

    // 2. Another user joined voice
    const handleUserJoined = (newUser) => {
      setVoiceUsers(prev => {
        if (prev.some(u => u.socketId === newUser.socketId)) return prev;
        return [...prev, newUser];
      });
      // The newly joined peer will initiate, we wait for their offer
      createPeerConnection(newUser.socketId, newUser, false);
    };

    // 3. WebRTC Signaling message (Offer / Answer / ICE Candidate)
    const handleSignal = async ({ fromSocketId, fromUserId, signal }) => {
      let pc = peersRef.current.get(fromSocketId);
      if (!pc) {
        pc = createPeerConnection(fromSocketId, { userId: fromUserId }, false);
      }

      try {
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('voice:signal', {
            toSocketId: fromSocketId,
            signal: { type: 'answer', sdp: pc.localDescription }
          });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        } else if (signal.type === 'candidate') {
          if (signal.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          }
        }
      } catch (err) {
        console.error('Error handling WebRTC signal:', err);
      }
    };

    // 4. Another user speaking status change
    const handleUserSpeaking = ({ socketId, isSpeaking: remoteSpeaking }) => {
      setVoiceUsers(prev => prev.map(u => 
        u.socketId === socketId ? { ...u, isSpeaking: remoteSpeaking } : u
      ));
    };

    // 5. Another user mute/deafen status change
    const handleUserStateChanged = ({ socketId, isMuted: remoteMuted, isDeafened: remoteDeafened }) => {
      setVoiceUsers(prev => prev.map(u => 
        u.socketId === socketId ? { ...u, isMuted: remoteMuted, isDeafened: remoteDeafened } : u
      ));
    };

    // 6. User left voice
    const handleUserLeft = ({ socketId }) => {
      const pc = peersRef.current.get(socketId);
      if (pc) {
        pc.close();
        peersRef.current.delete(socketId);
      }
      const audioEl = audioElementsRef.current.get(socketId);
      if (audioEl) {
        audioEl.pause();
        audioEl.srcObject = null;
        audioEl.remove();
        audioElementsRef.current.delete(socketId);
      }
      setVoiceUsers(prev => prev.filter(u => u.socketId !== socketId));
      setMutedPeerSocketIds(prev => {
        const next = new Set(prev);
        next.delete(socketId);
        return next;
      });
    };

    // 7. Force Muted by Host
    const handleForceMuted = () => {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
        setIsMuted(true);
      }
      const sock = socketService.getSocket();
      if (sock && roomId) {
        sock.emit('voice:state_change', {
          roomId,
          isMuted: true,
          isDeafened
        });
      }
    };

    socket.on('voice:all_users', handleAllUsers);
    socket.on('voice:user_joined', handleUserJoined);
    socket.on('voice:signal', handleSignal);
    socket.on('voice:user_speaking', handleUserSpeaking);
    socket.on('voice:user_state_changed', handleUserStateChanged);
    socket.on('voice:user_left', handleUserLeft);
    socket.on('voice:force_muted', handleForceMuted);

    return () => {
      socket.off('voice:all_users', handleAllUsers);
      socket.off('voice:user_joined', handleUserJoined);
      socket.off('voice:signal', handleSignal);
      socket.off('voice:user_speaking', handleUserSpeaking);
      socket.off('voice:user_state_changed', handleUserStateChanged);
      socket.off('voice:user_left', handleUserLeft);
      socket.off('voice:force_muted', handleForceMuted);
    };
  }, [inVoice, createPeerConnection, isDeafened, roomId]);

  // Teardown on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    inVoice,
    isMuted,
    isDeafened,
    isSpeaking,
    voiceUsers,
    mutedPeerSocketIds,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    toggleMutePeer,
    hostMuteUser,
    localStream: localStreamRef.current
  };
};
