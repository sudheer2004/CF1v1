import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageCircle, 
  Send, 
  Users, 
  Loader, 
  AlertCircle,
  RefreshCw,
  ArrowDown,
  X
} from 'lucide-react';
import socketService from '../services/socket.service';
import LinkifiedText from './LinkifiedText';
import { getAvatarColor, getInitials, formatRelativeTime } from '../utils/chatUtils';

export default function GlobalChatPage({ user, socket, socketReady, setView }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState(null);
  const [rateLimitInfo, setRateLimitInfo] = useState(null);
  const [showNewIndicator, setShowNewIndicator] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const initialLoadDone = useRef(false);
  const isLoadingMore = useRef(false);
  const prevScrollHeight = useRef(0);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Load initial messages - WAIT FOR AUTHENTICATION
  useEffect(() => {
    if (!socketReady || initialLoadDone.current) return;

    const waitForAuth = () => {
      if (!socketService.isAuthenticated()) {
        console.log('⏳ Waiting for authentication...');
        setTimeout(waitForAuth, 200);
        return;
      }

      console.log('📥 Loading initial global messages...');
      setIsLoading(true);
      socketService.loadGlobalMessages(0);
      initialLoadDone.current = true;
    };

    waitForAuth();
  }, [socketReady]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !socketReady) return;

    const handleMessagesLoaded = ({ messages: newMessages, hasMore: more, totalCount, offset: currentOffset }) => {
      console.log('✅ Global messages loaded:', {
        count: newMessages.length,
        hasMore: more,
        totalCount,
        offset: currentOffset
      });

      if (currentOffset === 0) {
        setMessages(newMessages);
        setIsLoading(false);
        setTimeout(scrollToBottom, 100);
      } else {
        setMessages(prev => [...newMessages, ...prev]);
        
        setTimeout(() => {
          if (messagesContainerRef.current && prevScrollHeight.current) {
            const newScrollHeight = messagesContainerRef.current.scrollHeight;
            messagesContainerRef.current.scrollTop = newScrollHeight - prevScrollHeight.current;
          }
          isLoadingMore.current = false;
        }, 50);
      }

      setHasMore(more);
      setOffset(currentOffset + newMessages.length);
    };

    const handleNewMessage = ({ message }) => {
      console.log('📨 New global message:', message);
      
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });

      if (!isNearBottom && message.senderId !== user.id) {
        setShowNewIndicator(true);
      } else {
        setTimeout(() => {
          if (messagesContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
            const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
            
            if (nearBottom || message.senderId === user.id) {
              scrollToBottom();
            }
          }
        }, 50);
      }
    };

    const handleOnlineCount = (count) => {
      console.log('👥 Online users:', count);
      setOnlineCount(count);
    };

    const handleRateLimit = ({ message, secondsUntilReset }) => {
      console.log('⚠️ Rate limit exceeded:', secondsUntilReset);
      setRateLimitInfo({ message, secondsUntilReset });
      
      const timer = setTimeout(() => {
        setRateLimitInfo(null);
      }, secondsUntilReset * 1000);

      return () => clearTimeout(timer);
    };

    const handleError = ({ message }) => {
      console.error('❌ Global chat error:', message);
      setError(message);
      setTimeout(() => setError(null), 5000);
    };

    socketService.onGlobalMessagesLoaded(handleMessagesLoaded);
    socketService.onGlobalMessage(handleNewMessage);
    socketService.onOnlineUsersCount(handleOnlineCount);
    socketService.onRateLimitExceeded(handleRateLimit);
    socketService.on('error', handleError);

    return () => {
      socketService.offGlobalMessagesLoaded(handleMessagesLoaded);
      socketService.offGlobalMessage(handleNewMessage);
      socketService.offOnlineUsersCount(handleOnlineCount);
      socketService.offRateLimitExceeded(handleRateLimit);
      socketService.off('error', handleError);
    };
  }, [socket, socketReady, user.id, scrollToBottom, isNearBottom]);

  // Handle scroll
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    
    // Check if near bottom
    const near = scrollHeight - scrollTop - clientHeight < 80;
    setIsNearBottom(near);
    if (near) setShowNewIndicator(false);

    // Load more when scrolled near top
    if (scrollTop < 100 && !isLoadingMore.current && hasMore) {
      console.log('📥 Loading more messages... offset:', offset);
      isLoadingMore.current = true;
      prevScrollHeight.current = messagesContainerRef.current.scrollHeight;
      socketService.loadGlobalMessages(offset);
    }
  }, [hasMore, offset]);

  // Send message
  const handleSendMessage = useCallback((e) => {
    e.preventDefault();

    if (!inputValue.trim()) return;
    if (!socketReady) {
      setError('Not connected to server');
      return;
    }

    if (inputValue.length > 500) {
      setError('Message too long (max 500 characters)');
      return;
    }

    console.log('📤 Sending message:', inputValue);
    socketService.broadcastMessage(inputValue);
    setInputValue('');

    if (!isNearBottom) {
      setShowNewIndicator(true);
    } else {
      setTimeout(scrollToBottom, 50);
    }
  }, [inputValue, socketReady, isNearBottom, scrollToBottom]);

  // Reload messages
  const handleReload = () => {
    setMessages([]);
    setOffset(0);
    setIsLoading(true);
    initialLoadDone.current = false;
    socketService.loadGlobalMessages(0);
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0a0a0f]">
      {/* Fixed Header - Below Navbar */}
      <header className="fixed top-16 left-0 right-0 z-40 border-b border-gray-800/50 bg-[#12121a]">
        <div className="mx-auto max-w-4xl px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Icon and Title */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-blue-600">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              
              <div>
                <h1 className="text-lg font-semibold text-white">
                  Global Chat
                </h1>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  <Users className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-400">
                    {onlineCount} online
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Reload button */}
            <button
              onClick={handleReload}
              disabled={isLoading}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800/50 disabled:opacity-50"
              title="Reload messages"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Error Banner - Below Header */}
      {error && (
        <div className="fixed top-[120px] left-0 right-0 z-30 bg-red-500/10 border-b border-red-500/30">
          <div className="mx-auto max-w-4xl px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-300">{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-300 hover:text-red-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Rate Limit Banner */}
      {rateLimitInfo && (
        <div className="fixed top-[120px] left-0 right-0 z-30 bg-yellow-500/10 border-b border-yellow-500/30">
          <div className="mx-auto max-w-4xl px-4 py-2.5 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-yellow-300">{rateLimitInfo.message}</span>
          </div>
        </div>
      )}

      {/* Scrollable Messages Area - Between Header and Footer */}
      <main className="flex-1 overflow-hidden" style={{ marginTop: '120px', marginBottom: '80px' }}>
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="h-full mx-auto max-w-4xl overflow-y-auto px-4 py-4"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#374151 transparent'
          }}
        >
          {/* Loading indicator for load more */}
          {isLoadingMore.current && (
            <div className="flex justify-center py-4">
              <Loader className="w-5 h-5 text-purple-400 animate-spin" />
            </div>
          )}

          {/* Initial loading */}
          {isLoading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Loader className="w-10 h-10 text-purple-400 animate-spin" />
              <p className="text-sm text-gray-400">Loading messages...</p>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-800/50">
                <MessageCircle className="h-8 w-8 text-gray-600" />
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-white">No messages yet</p>
                <p className="text-sm text-gray-500 mt-1">Be the first to start the conversation!</p>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div className="space-y-0.5">
              {messages.map((msg, i) => {
                const isOwn = msg.senderId === user.id;
                const prevMsg = messages[i - 1];
                const sameSender = prevMsg?.senderId === msg.senderId;
                const showAvatar = !sameSender;

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${
                      !sameSender && i > 0 ? 'mt-4' : ''
                    }`}
                  >
                    {/* Avatar for others */}
                    {!isOwn && (
                      <div className={`mr-2.5 flex-shrink-0 ${sameSender ? 'w-8' : ''}`}>
                        {showAvatar && (
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: getAvatarColor(msg.senderId) }}
                          >
                            {getInitials(msg.senderName)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Message Content */}
                    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%]`}>
                      {/* Username - only show for others and when not same sender */}
                      {!isOwn && showAvatar && (
                        <span className="text-xs font-medium text-purple-400 mb-1 px-0.5">
                          {msg.senderName}
                        </span>
                      )}
                      
                      {/* Message Bubble */}
                      <div
                        className={`rounded-2xl px-3.5 py-2 ${
                          isOwn
                            ? 'rounded-br-md bg-gradient-to-br from-purple-600 to-blue-600 text-white'
                            : 'rounded-bl-md bg-[#1e1e2e] text-white'
                        }`}
                      >
                        {/* Message Text */}
                        <LinkifiedText 
                          text={msg.content}
                          className="text-sm leading-relaxed break-words"
                        />
                        
                        {/* Timestamp */}
                        <p
                          className={`text-[10px] mt-1 ${
                            isOwn ? 'text-purple-200/60' : 'text-gray-500'
                          }`}
                        >
                          {formatRelativeTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* New messages indicator */}
        {showNewIndicator && (
          <button
            onClick={() => {
              scrollToBottom();
              setShowNewIndicator(false);
            }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600 text-white text-sm font-medium shadow-lg hover:bg-purple-700 transition-colors"
          >
            <ArrowDown className="h-4 w-4" />
            New messages
          </button>
        )}
      </main>

      {/* Fixed Input Bar - Bottom */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-800/50 bg-[#12121a]">
        <form onSubmit={handleSendMessage} className="mx-auto max-w-4xl px-4 py-3 flex items-center gap-3">
          {/* Input Field */}
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              rateLimitInfo
                ? `Please wait ${rateLimitInfo.secondsUntilReset}s...`
                : 'Type your message...'
            }
            disabled={!socketReady || !!rateLimitInfo}
            maxLength={500}
            className="flex-1 rounded-full bg-[#1e1e2e] border border-gray-800/50 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-purple-600/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          />
          
          {/* Send Button */}
          <button
            type="submit"
            disabled={!socketReady || !inputValue.trim() || !!rateLimitInfo}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:hover:bg-purple-600 transition-colors"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

        {/* Connection status */}
        {!socketReady && (
          <div className="mx-auto max-w-4xl px-4 pb-2 flex items-center justify-center gap-2">
            <Loader className="w-3 h-3 text-yellow-400 animate-spin" />
            <span className="text-xs text-yellow-400">Connecting to server...</span>
          </div>
        )}
      </footer>
    </div>
  );
}