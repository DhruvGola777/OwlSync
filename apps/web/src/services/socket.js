import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4001';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect(token) {
    if (this.socket) {
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected successfully');
    });

    this.socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinRoom(roomId) {
    if (this.socket) {
      this.socket.emit('room:join', { roomId });
    }
  }

  leaveRoom(roomId) {
    if (this.socket) {
      this.socket.emit('room:leave', { roomId });
    }
  }

  getSocket() {
    return this.socket;
  }
}

export const socketService = new SocketService();
