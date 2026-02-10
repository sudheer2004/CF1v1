import { io } from "socket.io-client";

class SocketService {
  constructor() {
    this.socket = null;
    this.authenticated = false;
    this.eventHandlers = new Map();
  }

  connect() {
    if (this.socket?.connected) {
      return this.socket;
    }

    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5001";
    const socketUrl = apiUrl.replace("/api", "");

    this.socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      timeout: 10000,
      autoConnect: true,
    });

    this.socket.on("connect", () => {
      const token = localStorage.getItem("token");

      console.log("✅ Connected ", token);

      if (token && !this.authenticated) {
        this.authenticate(token);
      }
    });

    this.socket.on("disconnect", (reason) => {
      this.authenticated = false;
    });

    this.socket.on("connect_error", (error) => {
      console.error("🔴 Socket connection error:", error.message);
      console.error("Full error:", error);
    });

    // FIXED: Better error handling - ONLY for non-authentication errors
    this.socket.on("error", (errorData) => {
      console.error("🔴 Socket error event received:", errorData);

      // Extract the message from various error formats
      let errorMessage = "An error occurred";

      if (typeof errorData === "string") {
        errorMessage = errorData;
      } else if (errorData && typeof errorData === "object") {
        errorMessage =
          errorData.message || errorData.error || JSON.stringify(errorData);
      }

      console.error("🔴 Processed error message:", errorMessage);

      // Dispatch as a custom window event so any component can listen
      window.dispatchEvent(
        new CustomEvent("socket-error", {
          detail: { message: errorMessage, originalError: errorData },
        }),
      );
    });

    return this.socket;
  }

  authenticate(token) {
    if (!this.socket?.connected) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, 10000);

        const checkConnection = () => {
          if (this.socket?.connected) {
            clearTimeout(timeout);
            this.socket.off("connect", checkConnection);
            this.doAuthenticate(token).then(resolve).catch(reject);
          }
        };

        if (this.socket?.connected) {
          clearTimeout(timeout);
          this.doAuthenticate(token).then(resolve).catch(reject);
        } else {
          this.socket.on("connect", checkConnection);
        }
      });
    }

    return this.doAuthenticate(token);
  }

  // FIXED: Use named handlers and proper cleanup
  doAuthenticate(token) {
    this.socket.emit("authenticate", token);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Clean up listeners on timeout
        this.socket.off("authenticated", onAuthenticated);
        this.socket.off("error", onAuthError);
        reject(new Error("Authentication timeout"));
      }, 5000);

      const onAuthenticated = (data) => {
        clearTimeout(timeout);
        this.socket.off("error", onAuthError);
        this.authenticated = true;
        console.log("✅ Authentication successful:", data);
        resolve(data);
      };

      const onAuthError = (error) => {
        clearTimeout(timeout);
        this.socket.off("authenticated", onAuthenticated);
        console.error("❌ Authentication failed:", error);
        reject(error);
      };

      // CRITICAL: Use 'once' to prevent listener leaks
      this.socket.once("authenticated", onAuthenticated);
      
      // CRITICAL: Use named handler so we can remove it properly
      this.socket.once("error", onAuthError);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.authenticated = false;
      this.eventHandlers.clear();
    }
  }

  on(event, handler) {
    if (!this.socket) {
      console.warn("⚠️ Socket not initialized");
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
    console.log("📤 Event :: ", data);

    if (!this.socket?.connected) {
      console.error("❌ Cannot emit, socket not connected");
      return;
    }

    this.socket.emit(event, data);
  }

  // ==================== MATCHMAKING ====================

  joinMatchmaking(criteria) {
    if (!criteria.ratingMin || !criteria.ratingMax || !criteria.duration) {
      console.error("❌ Invalid matchmaking criteria:", criteria);
      throw new Error("Missing required matchmaking criteria");
    }

    const validCriteria = {
      ratingMin: criteria.ratingMin,
      ratingMax: criteria.ratingMax,
      duration: criteria.duration,
      tags: criteria.tags || [],
      minYear: criteria.minYear || null,
    };

    this.emit("join-matchmaking", validCriteria);
  }

  leaveMatchmaking() {
    this.emit("leave-matchmaking");
  }

  // ==================== DUEL ====================

  createDuel(settings) {
    const validSettings = {
      ...settings,
      tags: settings.tags || [],
      minYear: settings.minYear || null,
    };

    this.emit("create-duel", validSettings);
  }

  joinDuel(duelCode) {
    this.emit("join-duel", duelCode);
  }

  // ==================== MATCH ACTIONS ====================

  giveUp(matchId) {
    this.emit("give-up", { matchId });
  }

  offerDraw(matchId) {
    this.emit("offer-draw", { matchId });
  }

  acceptDraw(matchId) {
    this.emit("accept-draw", { matchId });
  }

  rejectDraw(matchId) {
    this.emit("reject-draw", { matchId });
  }

  // ==================== CHAT METHODS (MATCH) ====================

  getMatchMessages(matchId) {
    this.emit("get-match-messages", { matchId });
  }

  sendMessage(matchId, content) {
    this.emit("send-message", { matchId, content });
  }

  onNewMessage(matchId, handler) {
    const event = `new-message-${matchId}`;
    this.on(event, handler);
  }

  offNewMessage(matchId, handler) {
    const event = `new-message-${matchId}`;
    this.off(event, handler);
  }

  onMessagesLoaded(handler) {
    this.on("match-messages-loaded", handler);
  }

  offMessagesLoaded(handler) {
    this.off("match-messages-loaded", handler);
  }

  // ==================== GLOBAL CHAT METHODS ====================

  loadGlobalMessages(offset = 0) {
    console.log("📥 Requesting global messages with offset:", offset);
    this.emit("load-global-messages", { offset });
  }

  broadcastMessage(content) {
    if (!content || content.trim().length === 0) {
      console.error("❌ Cannot send empty message");
      return;
    }

    if (content.length > 500) {
      console.error("❌ Message too long (max 500 characters)");
      return;
    }

    console.log("📤 Broadcasting message:", content);
    this.emit("broadcast", content.trim());
  }

  onGlobalMessagesLoaded(handler) {
    this.on("global-messages-loaded", handler);
  }

  offGlobalMessagesLoaded(handler) {
    this.off("global-messages-loaded", handler);
  }

  onGlobalMessage(handler) {
    this.on("global-message", handler);
  }

  offGlobalMessage(handler) {
    this.off("global-message", handler);
  }

  onOnlineUsersCount(handler) {
    this.on("online-users-count", handler);
  }

  offOnlineUsersCount(handler) {
    this.off("online-users-count", handler);
  }

  onRateLimitExceeded(handler) {
    this.on("rate-limit-exceeded", handler);
  }

  offRateLimitExceeded(handler) {
    this.off("rate-limit-exceeded", handler);
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

  waitForConnection(timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve(true);
        return;
      }

      const timer = setTimeout(() => {
        this.socket?.off("connect", onConnect);
        reject(new Error("Connection timeout"));
      }, timeout);

      const onConnect = () => {
        clearTimeout(timer);
        resolve(true);
      };

      this.socket?.once("connect", onConnect);
    });
  }
}

const socketService = new SocketService();

export default socketService;