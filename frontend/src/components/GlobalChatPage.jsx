import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageCircle, 
  Send, 
  Users, 
  Loader, 
  AlertCircle,
  RefreshCw,
  ArrowDown,
  X,
  Pencil,
  Trash2,
  Check,
  X as XIcon,
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
  // NEW: edit/delete state
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const initialLoadDone = useRef(false);
  const isLoadingMore = useRef(false);
  const prevScrollHeight = useRef(0);
  const editInputRef = useRef(null);
  const visibleMessages = messages.filter(msg => !msg.isDeleted);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Load messages via REST API
  const fetchMessages = useCallback(async (currentOffset = 0) => {
    try {
      const { messages: newMessages, hasMore: more } = await socketService.loadGlobalMessages(currentOffset);

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
    } catch (err) {
      console.error('❌ Failed to load global messages:', err);
      setError('Failed to load messages. Please try again.');
      setIsLoading(false);
      isLoadingMore.current = false;
    }
  }, [scrollToBottom]);

  // Load initial messages on mount
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    setIsLoading(true);
    fetchMessages(0);
  }, [fetchMessages]);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingMessageId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingMessageId]);

  // Socket event listeners (only for real-time new messages)
  useEffect(() => {
    if (!socket || !socketReady) return;

    const handleNewMessage = ({ message }) => {
      console.log('📨 New global message:', message);

      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
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

    // NEW: real-time edit sync from other clients
    const handleMessageEdited = ({ message }) => {
      setMessages(prev =>
        prev.map(m => m.id === message.id ? { ...m, content: message.content, isEdited: true } : m)
      );
    };

    // NEW: real-time delete sync from other clients
    const handleMessageDeleted = ({ message }) => {
      setMessages(prev =>
        prev.map(m => m.id === message.id ? { ...m, isDeleted: true } : m)
      );
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

    socketService.onGlobalMessage(handleNewMessage);
    socketService.onGlobalMessageEdited(handleMessageEdited);
    socketService.onGlobalMessageDeleted(handleMessageDeleted);
    socketService.onOnlineUsersCount(handleOnlineCount);
    socketService.onRateLimitExceeded(handleRateLimit);
    socketService.on('error', handleError);

    return () => {
      socketService.offGlobalMessage(handleNewMessage);
      socketService.offGlobalMessageEdited(handleMessageEdited);
      socketService.offGlobalMessageDeleted(handleMessageDeleted);
      socketService.offOnlineUsersCount(handleOnlineCount);
      socketService.offRateLimitExceeded(handleRateLimit);
      socketService.off('error', handleError);
    };
  }, [socket, socketReady, user.id, scrollToBottom, isNearBottom]);

  // Handle scroll
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;

    const near = scrollHeight - scrollTop - clientHeight < 80;
    setIsNearBottom(near);
    if (near) setShowNewIndicator(false);

    if (scrollTop < 100 && !isLoadingMore.current && hasMore) {
      console.log('📥 Loading more messages... offset:', offset);
      isLoadingMore.current = true;
      prevScrollHeight.current = messagesContainerRef.current.scrollHeight;
      fetchMessages(offset);
    }
  }, [hasMore, offset, fetchMessages]);

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
    fetchMessages(0);
    initialLoadDone.current = true;
  };

  // NEW: Start editing a message
  const startEdit = (msg) => {
    setEditingMessageId(msg.id);
    setEditValue(msg.content);
  };

  // NEW: Cancel editing
  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditValue('');
  };

  // NEW: Submit edit
  const submitEdit = async (messageId) => {
    if (!editValue.trim()) return;
    try {
      await socketService.editGlobalMessage(messageId, editValue.trim());
      // Optimistic update for self
      setMessages(prev =>
        prev.map(m => m.id === messageId ? { ...m, content: editValue.trim(), isEdited: true } : m)
      );
      // Broadcast to other clients via socket
      socketService.emit('broadcast-message-edit', { messageId, content: editValue.trim() });
      setEditingMessageId(null);
      setEditValue('');
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  // NEW: Delete a message
  const handleDelete = async (messageId) => {
    try {
      await socketService.deleteGlobalMessage(messageId);
      // Optimistic update for self
      setMessages(prev =>
        prev.map(m => m.id === messageId ? { ...m, isDeleted: true } : m)
      );
      // Broadcast to other clients via socket
      socketService.emit('broadcast-message-delete', { messageId });
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  // NEW: Check if message is within 15 min edit window
  const canEdit = (msg) => {
    return !msg.isDeleted && Date.now() - new Date(msg.createdAt).getTime() < 15 * 60 * 1000;
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0a0a0f]">
      {/* Fixed Header */}
      <header className="fixed top-16 left-0 right-0 z-40 border-b border-gray-800/50 bg-[#12121a]">
        <div className="mx-auto max-w-4xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: 'linear-gradient(135deg, #9333ea, #2563eb)' }}
              >
                <MessageCircle className="h-5 w-5 text-white" />
              </div>

              <div>
                <h1 className="text-lg font-semibold text-white">Global Chat</h1>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  <Users className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-400">{onlineCount} online</span>
                </div>
              </div>
            </div>

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

      {/* Error Banner */}
      {error && (
        <div className="fixed top-[120px] left-0 right-0 z-30 bg-red-500/10 border-b border-red-500/30">
          <div className="mx-auto max-w-4xl px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-300">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-300 hover:text-red-100">
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

      {/* Messages Area */}
      <main className="flex-1 overflow-hidden" style={{ marginTop: '120px', marginBottom: '80px' }}>
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="h-full mx-auto max-w-4xl overflow-y-auto px-4 py-4"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 transparent' }}
        >
          {/* Loading more indicator */}
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
          {!isLoading && visibleMessages.length === 0 && (
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
          {visibleMessages.length > 0 && (
            <div className="space-y-0.5">
              {visibleMessages.map((msg, i) => {
                const isOwn = msg.senderId === user.id;
                const prevMsg = visibleMessages[i - 1];
                const sameSender = prevMsg?.senderId === msg.senderId;
                const showAvatar = !sameSender;
                const isHovered = hoveredMessageId === msg.id;
                const isEditing = editingMessageId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className={`relative flex ${isOwn ? 'justify-end' : 'justify-start'} ${
                      !sameSender && i > 0 ? 'mt-4' : ''
                    }`}
                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
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
                      {!isOwn && showAvatar && (
                        <span className="text-xs font-medium text-purple-400 mb-1 px-0.5">
                          {msg.senderName}
                        </span>
                      )}

                      {/* Edit mode */}
                      {isEditing ? (
                        <div className="flex flex-col gap-1 w-full min-w-[260px]">
                          <input
                            ref={editInputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(msg.id); }
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            maxLength={500}
                            className="rounded-lg bg-[#2a2a3e] border border-purple-500/50 px-3 py-2 text-sm text-white outline-none w-full"
                          />
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                            <span>Enter to save · Esc to cancel</span>
                            <div className="ml-auto flex gap-1">
                              <button
                                onClick={() => submitEdit(msg.id)}
                                className="p-1 rounded bg-green-600/20 text-green-400 hover:bg-green-600/40"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 rounded bg-gray-600/20 text-gray-400 hover:bg-gray-600/40"
                              >
                                <XIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Message Bubble — inline style guarantees bg renders */
                        <div
                          className={`rounded-2xl px-3.5 py-2 text-white ${isOwn ? 'rounded-br-md' : 'rounded-bl-md'}`}
                          style={isOwn
                            ? { background: 'linear-gradient(135deg, #9333ea, #2563eb)' }
                            : { backgroundColor: '#1e1e2e' }
                          }
                        >
                          <LinkifiedText
                            text={msg.content}
                            className="text-sm leading-relaxed break-words"
                          />
                          <p className={`text-[10px] mt-1 flex items-center gap-1 ${isOwn ? 'text-purple-200' : 'text-gray-500'}`}>
                            {formatRelativeTime(msg.createdAt)}
                            {msg.isEdited && <span className="italic">(edited)</span>}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* NEW: Discord-style action toolbar on hover (own messages only) */}
                    {isOwn && isHovered && !isEditing && !msg.isDeleted && (
                      <div className="absolute -top-4 right-0 flex items-center gap-0.5 rounded-lg border border-gray-700/50 bg-[#1e1e2e] px-1.5 py-1 shadow-xl z-10">
                        {canEdit(msg) && (
                          <button
                            onClick={() => startEdit(msg)}
                            className="rounded p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
                            title="Edit (within 15 minutes)"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(msg.id)}
                          className="rounded p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete message"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
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
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-medium shadow-lg hover:opacity-90 transition-colors"
            style={{ backgroundColor: '#9333ea' }}
          >
            <ArrowDown className="h-4 w-4" />
            New messages
          </button>
        )}
      </main>

      {/* Fixed Input Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-800/50 bg-[#12121a]">
        <form onSubmit={handleSendMessage} className="mx-auto max-w-4xl px-4 py-3 flex items-center gap-3">
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

          <button
            type="submit"
            disabled={!socketReady || !inputValue.trim() || !!rateLimitInfo}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white hover:opacity-90 disabled:opacity-40 transition-colors"
            style={{ backgroundColor: '#9333ea' }}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

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
