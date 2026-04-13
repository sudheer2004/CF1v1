import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, Users, X, Minus, Maximize2, Pencil, Trash2, Check, X as XIcon } from 'lucide-react';
import socketService from '../services/socket.service';
import LinkifiedText from './LinkifiedText';
import { getAvatarColor, getInitials, formatRelativeTime } from '../utils/chatUtils';

export default function GlobalChat({ user, socket, socketReady, setView }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [rateLimitInfo, setRateLimitInfo] = useState(null);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [actionError, setActionError] = useState(null);

  const messagesEndRef = useRef(null);
  const initialLoadDone = useRef(false);
  const editInputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const visibleMessages = messages.filter(msg => !msg.isDeleted);

  // Load messages via REST API when chat is opened
  useEffect(() => {
    if (!isOpen || initialLoadDone.current) return;
    initialLoadDone.current = true;
    const load = async () => {
      try {
        const { messages: newMessages } = await socketService.loadGlobalMessages(0);
        setMessages(newMessages);
        setTimeout(scrollToBottom, 100);
      } catch (err) {
        console.error('❌ Failed to load global messages:', err);
      }
    };
    load();
  }, [isOpen, scrollToBottom]);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingMessageId && editInputRef.current) editInputRef.current.focus();
  }, [editingMessageId]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !socketReady) return;

    const handleNewMessage = ({ message }) => {
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      if (!isOpen && message.senderId !== user.id) {
        setUnreadCount(prev => prev + 1);
      } else {
        setTimeout(scrollToBottom, 50);
      }
    };

    // NEW: real-time edit sync
    const handleMessageEdited = ({ message }) => {
      setMessages(prev => prev.map(m => m.id === message.id ? { ...m, content: message.content, isEdited: true } : m));
    };

    // NEW: real-time delete sync
    const handleMessageDeleted = ({ message }) => {
      setMessages(prev => prev.map(m => m.id === message.id ? { ...m, isDeleted: true } : m));
    };

    const handleOnlineCount = (count) => setOnlineCount(count);

    const handleRateLimit = ({ message, secondsUntilReset }) => {
      setRateLimitInfo({ message, secondsUntilReset });
      setTimeout(() => setRateLimitInfo(null), secondsUntilReset * 1000);
    };

    socketService.onGlobalMessage(handleNewMessage);
    socketService.onGlobalMessageEdited(handleMessageEdited);
    socketService.onGlobalMessageDeleted(handleMessageDeleted);
    socketService.onOnlineUsersCount(handleOnlineCount);
    socketService.onRateLimitExceeded(handleRateLimit);

    return () => {
      socketService.offGlobalMessage(handleNewMessage);
      socketService.offGlobalMessageEdited(handleMessageEdited);
      socketService.offGlobalMessageDeleted(handleMessageDeleted);
      socketService.offOnlineUsersCount(handleOnlineCount);
      socketService.offRateLimitExceeded(handleRateLimit);
    };
  }, [socket, socketReady, user.id, isOpen, scrollToBottom]);

  useEffect(() => {
    if (isOpen) { setUnreadCount(0); setTimeout(scrollToBottom, 100); }
  }, [isOpen, scrollToBottom]);

  const handleSendMessage = useCallback((e) => {
    e.preventDefault();
    if (!inputValue.trim() || !socketReady || rateLimitInfo) return;
    socketService.broadcastMessage(inputValue);
    setInputValue('');
    setTimeout(scrollToBottom, 50);
  }, [inputValue, socketReady, rateLimitInfo, scrollToBottom]);

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
      // Optimistic update
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: editValue.trim(), isEdited: true } : m));
      // Broadcast to other clients
      socketService.emit('broadcast-message-edit', { messageId, content: editValue.trim() });
      setEditingMessageId(null);
      setEditValue('');
    } catch (err) {
      setActionError(err.message);
      setTimeout(() => setActionError(null), 3000);
    }
  };

  // NEW: Delete message
  const handleDelete = async (messageId) => {
    try {
      await socketService.deleteGlobalMessage(messageId);
      // Optimistic update
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isDeleted: true } : m));
      // Broadcast to other clients
      socketService.emit('broadcast-message-delete', { messageId });
    } catch (err) {
      setActionError(err.message);
      setTimeout(() => setActionError(null), 3000);
    }
  };

  // Check if message is within 15 min edit window
  const canEdit = (msg) => {
    return !msg.isDeleted && Date.now() - new Date(msg.createdAt).getTime() < 15 * 60 * 1000;
  };

  const handleMaximize = () => {
    setIsOpen(false);
    if (setView) setView('global-chat');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110"
        style={{ background: 'linear-gradient(135deg, #9333ea, #2563eb)' }}
        aria-label="Open chat"
      >
        <MessageCircle className="h-6 w-6 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex w-[360px] flex-col rounded-2xl bg-[#12121a] border border-gray-800/50 shadow-2xl sm:w-[380px]"
      style={{ height: 'min(580px, calc(100vh - 60px))' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-2xl bg-[#12121a] border-b border-gray-800/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #9333ea, #2563eb)' }}>
            <MessageCircle className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Global Chat</h3>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
              <Users className="h-3 w-3" />
              <span>{onlineCount} online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleMaximize} className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors" title="Open full screen">
            <Maximize2 className="h-4 w-4" />
          </button>
          <button onClick={() => setIsOpen(false)} className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors">
            <Minus className="h-4 w-4" />
          </button>
          <button onClick={() => setIsOpen(false)} className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Action error */}
      {actionError && (
        <div className="px-3 py-1.5 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400">{actionError}</div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 bg-[#0a0a0f]">
        <div className="space-y-0.5">
          {visibleMessages.map((msg, i) => {
            const isOwn = msg.senderId === user.id;
            const prevMsg = visibleMessages[i - 1];
            const sameSender = prevMsg?.senderId === msg.senderId;
            const isHovered = hoveredMessageId === msg.id;
            const isEditing = editingMessageId === msg.id;

            return (
              <div
                key={msg.id}
                className={`relative flex ${isOwn ? 'justify-end' : 'justify-start'} ${!sameSender && i > 0 ? 'mt-3' : 'mt-0.5'}`}
                onMouseEnter={() => setHoveredMessageId(msg.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
              >
                {/* Avatar */}
                {!isOwn && !sameSender && (
                  <div className="mr-2 mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                    style={{ backgroundColor: getAvatarColor(msg.senderId) }}>
                    {getInitials(msg.senderName)}
                  </div>
                )}
                {!isOwn && sameSender && <div className="mr-2 w-7 flex-shrink-0" />}

                <div className={`max-w-[75%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                  {!isOwn && !sameSender && (
                    <p className="mb-0.5 text-[11px] font-medium text-purple-400 px-0.5">{msg.senderName}</p>
                  )}

                  {/* Edit mode */}
                  {isEditing ? (
                    <div className="flex flex-col gap-1 w-full min-w-[200px]">
                      <input
                        ref={editInputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(msg.id); }
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        maxLength={500}
                        className="rounded-lg bg-[#2a2a3e] border border-purple-500/50 px-3 py-1.5 text-sm text-white outline-none w-full"
                      />
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                        <span>Enter to save</span>
                        <span>·</span>
                        <span>Esc to cancel</span>
                        <div className="ml-auto flex gap-1">
                          <button onClick={() => submitEdit(msg.id)} className="p-1 rounded bg-green-600/20 text-green-400 hover:bg-green-600/40">
                            <Check className="h-3 w-3" />
                          </button>
                          <button onClick={cancelEdit} className="p-1 rounded bg-gray-600/20 text-gray-400 hover:bg-gray-600/40">
                            <XIcon className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Message bubble */
                    <div
                      className={`rounded-2xl px-3 py-1.5 text-sm text-white ${isOwn ? 'rounded-br-md' : 'rounded-bl-md'}`}
                      style={isOwn ? { background: 'linear-gradient(135deg, #9333ea, #2563eb)' } : { backgroundColor: '#1e1e2e' }}
                    >
                      <LinkifiedText text={msg.content} className="break-words leading-relaxed" />
                      <p className={`mt-0.5 text-[10px] flex items-center gap-1 ${isOwn ? 'text-purple-200' : 'text-gray-500'}`}>
                        {formatRelativeTime(msg.createdAt)}
                        {msg.isEdited && <span className="italic">(edited)</span>}
                      </p>
                    </div>
                  )}
                </div>

                {/* Discord-style action buttons on hover (own messages only) */}
                {isOwn && isHovered && !isEditing && !msg.isDeleted && (
                  <div
                    className="absolute -top-3 right-0 flex items-center gap-0.5 rounded-lg border border-gray-700/50 bg-[#1e1e2e] px-1 py-0.5 shadow-lg z-10"
                  >
                    {canEdit(msg) && (
                      <button
                        onClick={() => startEdit(msg)}
                        className="rounded p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
                        title="Edit message"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(msg.id)}
                      className="rounded p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete message"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="border-t border-gray-800/50 bg-[#12121a] px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={rateLimitInfo ? `Wait ${rateLimitInfo.secondsUntilReset}s...` : 'Type a message...'}
            disabled={!socketReady || !!rateLimitInfo}
            maxLength={500}
            className="flex-1 rounded-full bg-[#1e1e2e] border border-gray-800/50 px-4 py-2 text-sm text-white placeholder:text-gray-500 outline-none focus:border-purple-600/50 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!socketReady || !inputValue.trim() || !!rateLimitInfo}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:opacity-90 disabled:opacity-40 transition-colors"
            style={{ backgroundColor: '#9333ea' }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        {inputValue.length > 400 && (
          <p className="mt-1 text-right text-[10px] text-gray-500">{inputValue.length}/500</p>
        )}
      </form>
    </div>
  );
}
