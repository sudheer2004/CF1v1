import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, X, AlertCircle, Loader } from 'lucide-react';
import socketService from '../services/socket.service';

export default function ChatBubble({ matchId, user, isOpen: externalIsOpen, onToggle }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const messageListenersRegistered = useRef(false);
  const notificationSound = useRef(null);

  const chatIsOpen = externalIsOpen !== undefined ? externalIsOpen : isOpen;
  const toggleChat = onToggle || (() => setIsOpen(!isOpen));

  useEffect(() => {
    notificationSound.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUA0PVKzo7qxZFg1Mn+Hxv2whBSyFzvPZhzYHImm+7+KZTg0NUqzn7KhWFApFn+Dxv2whBTGH0fPTgjMGHm/A7+OZUA0PVKzo7qxZFg1Mn+Hxv2whBSyFzvPZhzYHImi+7+OZUA0OVKzo7qxZFg1Nn+Dxv2whBTGH0fPTgjMGHm7A7+OZUA0PVKzo7qxZFg1Mn+Hxv2whBSyFzvPZhzYHImm+7+OZUA0OVKzo7qxZFg1Mn+Hxv2whBTGH0fPTgjMGHm7A7+OZUA0PVKzo7qxZFg1Mn+Hxv2whBSyFzvPZhzYHImm+7+OZUA0OVKzo7qxZFg1Mn+Hxv2whBTGH0fPTgjMGHm7A7+OZUA0PVKzo7qxZFg1Mn+Hxv2whBSyFzvPZhzYHImm+7+OZUA0OVKzo7qxZFg1Mn+Hxv2whBTGH0fPTgjMGHm7A7+OZUA0PVKzo7qxZFg1Mn+Hxv2whBSyFzvPZhzYHImm+7+OZUA0OVKzo7qxZFg1Mn+Hxv2whBTGH0fPTgjMGHm7A7+OZUA0PVKzo7qxZFg1Mn+Hxv2whBSyFzvPZhzYHImm+7+OZUA0OVKzo7qxZFg1Mn+Hxv2whBTGH0fPTgjMGHm7A7+OZUA0PVKzo7qxZFg==');
  }, []);

  // Monitor socket connection
  useEffect(() => {
    const checkConnection = () => {
      const isConnected = socketService.isConnected();
      const isAuthenticated = socketService.isAuthenticated();
      
      if (isConnected && isAuthenticated) {
        setConnectionStatus('connected');
      } else if (isConnected && !isAuthenticated) {
        setConnectionStatus('authenticating');
      } else {
        setConnectionStatus('disconnected');
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 2000);

    return () => clearInterval(interval);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load messages when chat opens
  useEffect(() => {
    if (!matchId || !chatIsOpen || messageListenersRegistered.current) return;

    const loadMessages = () => {
      if (!socketService.isConnected() || !socketService.isAuthenticated()) {
      
        return false;
      }

    
      setLoading(true);
      socketService.emit('get-match-messages', { matchId });
      return true;
    };

    if (!loadMessages()) {
      const retryInterval = setInterval(() => {
        if (loadMessages()) {
          clearInterval(retryInterval);
        }
      }, 500);

      setTimeout(() => {
        clearInterval(retryInterval);
        if (connectionStatus !== 'connected') {
          setError('Unable to connect to chat server');
          setLoading(false);
        }
      }, 10000);

      return () => clearInterval(retryInterval);
    }
  }, [matchId, chatIsOpen, connectionStatus]);

  // Listen for messages
  useEffect(() => {
    if (!matchId || messageListenersRegistered.current) return;

    const handleMessagesLoaded = (data) => {
    
      setMessages(data.messages);
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    };

    const handleNewMessage = (data) => {
     
      setMessages(prev => [...prev, data.message]);
      
      if (!chatIsOpen && data.message.senderId !== user.id) {
        setUnreadCount(prev => prev + 1);
        
        if (notificationSound.current) {
          notificationSound.current.play().catch(err => {
            console.log(err);
          });
        }
      }
      
      setTimeout(scrollToBottom, 100);
    };

    socketService.on('match-messages-loaded', handleMessagesLoaded);
    socketService.on(`new-message-${matchId}`, handleNewMessage);

    messageListenersRegistered.current = true;

    return () => {
      socketService.off('match-messages-loaded', handleMessagesLoaded);
      socketService.off(`new-message-${matchId}`, handleNewMessage);
      messageListenersRegistered.current = false;
    };
  }, [matchId, user.id, chatIsOpen]);

  useEffect(() => {
    if (chatIsOpen) {
      setUnreadCount(0);
      setTimeout(scrollToBottom, 100);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [chatIsOpen]);

  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    
    if (!newMessage.trim()) return;

    if (!socketService.isConnected()) {
      setError('Not connected. Please wait...');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (!socketService.isAuthenticated()) {
      setError('Not authenticated. Please refresh.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (newMessage.length > 500) {
      setError('Message too long (max 500 characters)');
      setTimeout(() => setError(''), 3000);
      return;
    }


    
    try {
      socketService.emit('send-message', {
        matchId,
        content: newMessage.trim(),
      });
      
      setNewMessage('');
      setError('');
    } catch (err) {
      console.error('❌ Send message error:', err);
      setError('Failed to send message');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) {
      return 'Just now';
    }
    
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins}m ago`;
    }
    
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    return date.toLocaleString([], { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {chatIsOpen && (
        <div className="mb-4 w-96 h-[500px] bg-gray-800 rounded-lg shadow-2xl border border-purple-500/30 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-5 h-5 text-white" />
              <div>
                <h3 className="text-white font-semibold">Match Chat</h3>
                <p className="text-xs text-white/70">
                  {connectionStatus === 'connected' 
                    ? 'Connected' 
                    : connectionStatus === 'authenticating'
                    ? 'Authenticating...'
                    : 'Reconnecting...'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleChat}
              className="text-white hover:bg-white/20 rounded-full p-1 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-red-500/20 border-b border-red-500/50 p-2 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-red-300 text-xs">{error}</p>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-900/50">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader className="w-6 h-6 text-purple-400 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((msg, index) => {
                const isOwn = msg.senderId === user.id;
                return (
                  <div
                    key={msg.id || index}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg px-3 py-2 ${
                        isOwn
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-100'
                      }`}
                    >
                      {!isOwn && (
                        <p className="text-xs text-gray-400 mb-1">
                          {msg.senderName}
                        </p>
                      )}
                      <p className="text-sm break-words">{msg.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          isOwn ? 'text-purple-200' : 'text-gray-500'
                        }`}
                      >
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-gray-800 border-t border-gray-700">
            <div className="flex space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  connectionStatus === 'connected'
                    ? 'Type a message...'
                    : 'Connecting...'
                }
                maxLength={500}
                disabled={connectionStatus !== 'connected'}
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || connectionStatus !== 'connected'}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {newMessage.length}/500
            </p>
          </div>
        </div>
      )}

      {/* Chat Button */}
      <button
        onClick={toggleChat}
        className={`rounded-full p-4 shadow-lg transition transform hover:scale-110 relative ${
          connectionStatus === 'connected'
            ? 'bg-purple-600 hover:bg-purple-700'
            : 'bg-gray-600 hover:bg-gray-700'
        }`}
        title={connectionStatus === 'connected' ? 'Open Chat' : 'Chat (Connecting...)'}
      >
        <MessageCircle className="w-6 h-6 text-white" />
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
        {connectionStatus === 'disconnected' && (
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
        )}
      </button>
    </div>
  );
}