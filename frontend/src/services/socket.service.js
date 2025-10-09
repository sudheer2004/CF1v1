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
    
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
    const socketUrl = apiUrl.replace('/api', '');
    
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

    // FIXED: Better error handling
    this.socket.on('error', (errorData) => {
      console.error('🔴 Socket error event received:', errorData);
      
      // Extract the message from various error formats
      let errorMessage = 'An error occurred';
      
      if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else if (errorData && typeof errorData === 'object') {
        errorMessage = errorData.message || errorData.error || JSON.stringify(errorData);
      }
      
      console.error('🔴 Processed error message:', errorMessage);
      
      // Dispatch as a custom window event so any component can listen
      window.dispatchEvent(new CustomEvent('socket-error', { 
        detail: { message: errorMessage, originalError: errorData } 
      }));
    });

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

  // ==================== MATCHMAKING ====================
  
  /**
   * Join matchmaking queue with optional year filter
   * @param {Object} criteria - Matchmaking criteria
   * @param {number} criteria.ratingMin - Minimum problem rating (800-3500)
   * @param {number} criteria.ratingMax - Maximum problem rating (800-3500)
   * @param {number} criteria.duration - Match duration in minutes (1-180)
   * @param {string[]} criteria.tags - Problem tags (optional)
   * @param {number} criteria.minYear - Minimum problem year (optional, e.g. 2024)
   */
  joinMatchmaking(criteria) {
    console.log('🎯 Joining matchmaking queue:', criteria);
    
    // Validate criteria before sending
    if (!criteria.ratingMin || !criteria.ratingMax || !criteria.duration) {
      console.error('❌ Invalid matchmaking criteria:', criteria);
      throw new Error('Missing required matchmaking criteria');
    }

    // Ensure minYear is either null or a valid number
    const validCriteria = {
      ratingMin: criteria.ratingMin,
      ratingMax: criteria.ratingMax,
      duration: criteria.duration,
      tags: criteria.tags || [],
      minYear: criteria.minYear || null // Support year filter
    };

    this.emit('join-matchmaking', validCriteria);
  }

  leaveMatchmaking() {
    console.log('🚪 Leaving matchmaking queue');
    this.emit('leave-matchmaking');
  }

  // ==================== DUEL ====================
  
  /**
   * Create a duel with optional year filter
   * @param {Object} settings - Duel settings
   * @param {number} settings.ratingMin - Minimum problem rating
   * @param {number} settings.ratingMax - Maximum problem rating
   * @param {number} settings.duration - Match duration in minutes
   * @param {string[]} settings.tags - Problem tags (optional)
   * @param {number} settings.minYear - Minimum problem year (optional)
   */
  createDuel(settings) {
    console.log('⚔️ Creating duel:', settings);
    
    const validSettings = {
      ...settings,
      tags: settings.tags || [],
      minYear: settings.minYear || null // Support year filter
    };

    this.emit('create-duel', validSettings);
  }

  joinDuel(duelCode) {
    console.log('⚔️ Joining duel:', duelCode);
    this.emit('join-duel', duelCode);
  }

  // ==================== MATCH ACTIONS ====================
  
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

  rejectDraw(matchId) {
    console.log('❌ Rejecting draw:', matchId);
    this.emit('reject-draw', { matchId });
  }

  // ==================== CHAT METHODS ====================
  
  getMatchMessages(matchId) {
    console.log('📨 Getting messages for match:', matchId);
    this.emit('get-match-messages', { matchId });
  }

  sendMessage(matchId, content) {
    console.log('💬 Sending message:', { matchId, content });
    this.emit('send-message', { matchId, content });
  }

  onNewMessage(matchId, handler) {
    const event = `new-message-${matchId}`;
    console.log('👂 Listening for new messages:', event);
    this.on(event, handler);
  }

  offNewMessage(matchId, handler) {
    const event = `new-message-${matchId}`;
    console.log('🔇 Stopping message listener:', event);
    this.off(event, handler);
  }

  onMessagesLoaded(handler) {
    console.log('👂 Listening for messages loaded');
    this.on('match-messages-loaded', handler);
  }

  offMessagesLoaded(handler) {
    console.log('🔇 Stopping messages loaded listener');
    this.off('match-messages-loaded', handler);
  }

  // ==================== UTILITY METHODS ====================
  
  getSocket() {
    return this.socket;
  }

  isConnected() {
    return this.socket?.connected || false;
  }

  isAuthenticated() {
    return this.authenticated;
  }

  /**
   * Wait for socket connection
   * @param {number} timeout - Timeout in milliseconds (default: 5000)
   * @returns {Promise<boolean>}
   */
  waitForConnection(timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve(true);
        return;
      }

      const timer = setTimeout(() => {
        this.socket?.off('connect', onConnect);
        reject(new Error('Connection timeout'));
      }, timeout);

      const onConnect = () => {
        clearTimeout(timer);
        resolve(true);
      };

      this.socket?.once('connect', onConnect);
    });
  }
}

const socketService = new SocketService();

export default socketService;