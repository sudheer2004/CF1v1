import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect(token) {
    if (this.socket?.connected) return this.socket;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      if (token) {
        this.socket.emit('authenticate', token);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
      
      // Store for cleanup
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
      
      // Remove from stored listeners
      if (this.listeners.has(event)) {
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    }
  }

  // Matchmaking
  joinMatchmaking(data) {
    this.emit('join-matchmaking', data);
  }

  leaveMatchmaking() {
    this.emit('leave-matchmaking');
  }

  // Duel
  createDuel(data) {
    this.emit('create-duel', data);
  }

  joinDuel(duelCode) {
    this.emit('join-duel', duelCode);
  }
}

export default new SocketService();