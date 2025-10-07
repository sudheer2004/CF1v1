import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.authenticated = false;
    this.eventHandlers = new Map();
  }

  connect() {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return this.socket;
    }

    console.log('🔌 Connecting to socket server...');
    
    // FIX: Remove /api from the Socket.IO URL
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
    const socketUrl = apiUrl.replace('/api', ''); // Remove /api suffix if present
    
    console.log('Socket URL:', socketUrl);
    
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      timeout: 10000,
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
      
      // Re-authenticate on reconnection
      const token = localStorage.getItem('token');
      if (token && !this.authenticated) {
        console.log('🔐 Re-authenticating after reconnection...');
        this.authenticate(token);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      this.authenticated = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔴 Socket connection error:', error.message);
      console.error('Full error:', error);
    });

    this.socket.on('error', (error) => {
      console.error('🔴 Socket error:', error);
    });

    // Restore event handlers after reconnection
    this.socket.on('connect', () => {
      this.eventHandlers.forEach((handler, event) => {
        console.log('🔄 Re-registering event handler:', event);
      });
    });

    return this.socket;
  }

  authenticate(token) {
    if (!this.socket?.connected) {
      console.log('⚠️ Socket not connected, waiting for connection...');
      
      // Wait for connection before authenticating
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        const checkConnection = () => {
          if (this.socket?.connected) {
            clearTimeout(timeout);
            this.socket.off('connect', checkConnection);
            this.doAuthenticate(token).then(resolve).catch(reject);
          }
        };

        if (this.socket?.connected) {
          clearTimeout(timeout);
          this.doAuthenticate(token).then(resolve).catch(reject);
        } else {
          this.socket.on('connect', checkConnection);
        }
      });
    }

    return this.doAuthenticate(token);
  }

  doAuthenticate(token) {
    console.log('🔐 Authenticating socket connection...');
    this.socket.emit('authenticate', token);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, 5000);

      this.socket.once('authenticated', (data) => {
        clearTimeout(timeout);
        this.authenticated = true;
        console.log('✅ Socket authenticated:', data.userId);
        resolve(data);
      });

      this.socket.once('error', (error) => {
        clearTimeout(timeout);
        console.error('❌ Authentication failed:', error);
        reject(error);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting socket...');
      this.socket.disconnect();
      this.socket = null;
      this.authenticated = false;
      this.eventHandlers.clear();
    }
  }

  on(event, handler) {
    if (!this.socket) {
      console.warn('⚠️ Socket not initialized');
      return;
    }
    
    // Store handler for re-registration after reconnect
    this.eventHandlers.set(event, handler);
    this.socket.on(event, handler);
  }

  off(event, handler) {
    this.eventHandlers.delete(event);
    if (this.socket) {
      if (handler) {
        this.socket.off(event, handler);
      } else {
        this.socket.off(event);
      }
    }
  }

  emit(event, data) {
    if (!this.socket?.connected) {
      console.error('❌ Cannot emit, socket not connected');
      return;
    }
    
    console.log('📤 Emitting:', event, data);
    this.socket.emit(event, data);
  }

  // Matchmaking
  joinMatchmaking(criteria) {
    console.log('🎯 Joining matchmaking queue:', criteria);
    this.emit('join-matchmaking', criteria);
  }

  leaveMatchmaking() {
    console.log('🚪 Leaving matchmaking queue');
    this.emit('leave-matchmaking');
  }

  // Duel
  createDuel(settings) {
    console.log('⚔️ Creating duel:', settings);
    this.emit('create-duel', settings);
  }

  joinDuel(duelCode) {
    console.log('⚔️ Joining duel:', duelCode);
    this.emit('join-duel', duelCode);
  }

  // Match Actions
  giveUp(matchId) {
    console.log('🏳️ Giving up match:', matchId);
    this.emit('give-up', { matchId });
  }

  offerDraw(matchId) {
    console.log('🤝 Offering draw:', matchId);
    this.emit('offer-draw', { matchId });
  }

  acceptDraw(matchId) {
    console.log('✅ Accepting draw:', matchId);
    this.emit('accept-draw', { matchId });
  }

  getSocket() {
    return this.socket;
  }

  isConnected() {
    return this.socket?.connected || false;
  }

  isAuthenticated() {
    return this.authenticated;
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;