import { io } from 'socket.io-client';

export const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '');
  }
  const isBrowser = typeof window !== 'undefined';
  const isElectron = isBrowser && !!window.electronAPI;
  const isHosted = isBrowser && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

  if (isHosted || isElectron) {
    return 'https://owlsync-api.onrender.com';
  }
  return 'http://localhost:4000';
};

const SOCKET_URL = getSocketUrl();

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect(authToken) {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    const token = authToken || (typeof window !== 'undefined' ? (localStorage.getItem('owlsync_token') || localStorage.getItem('owlsync_guest_token')) : null);

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.socket = io(SOCKET_URL, {
      withCredentials: true,
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
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

  notifyFilesChanged(roomId) {
    if (this.socket && roomId) {
      this.socket.emit('project:files_changed', { roomId });
    }
  }

  getSocket() {
    return this.socket;
  }
}

export const socketService = new SocketService();
