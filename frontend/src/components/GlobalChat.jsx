import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, Users, X, Minus, Loader, Maximize2 } from 'lucide-react';
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

  const messagesEndRef = useRef(null);
  const initialLoadDone = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Load initial messages when opened
  useEffect(() => {
    if (!isOpen || !socketReady || initialLoadDone.current) return;

    const waitForAuth = () => {
      if (!socketService.isAuthenticated()) {
        setTimeout(waitForAuth, 200);
        return;
      }

      socketService.loadGlobalMessages(0);
      initialLoadDone.current = true;
    };

    waitForAuth();
  }, [isOpen, socketReady]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !socketReady) return;

    const handleMessagesLoaded = ({ messages: newMessages }) => {
      setMessages(newMessages);
      setTimeout(scrollToBottom, 100);
    };

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

    const handleOnlineCount = (count) => {
      setOnlineCount(count);
    };

    const handleRateLimit = ({ message, secondsUntilReset }) => {
      setRateLimitInfo({ message, secondsUntilReset });
      setTimeout(() => setRateLimitInfo(null), secondsUntilReset * 1000);
    };

    socketService.onGlobalMessagesLoaded(handleMessagesLoaded);
    socketService.onGlobalMessage(handleNewMessage);
    socketService.onOnlineUsersCount(handleOnlineCount);
    socketService.onRateLimitExceeded(handleRateLimit);

    return () => {
      socketService.offGlobalMessagesLoaded(handleMessagesLoaded);
      socketService.offGlobalMessage(handleNewMessage);
      socketService.offOnlineUsersCount(handleOnlineCount);
      socketService.offRateLimitExceeded(handleRateLimit);
    };
  }, [socket, socketReady, user.id, isOpen, scrollToBottom]);

  // Clear unread when opened
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      setTimeout(scrollToBottom, 100);
    }
  }, [isOpen, scrollToBottom]);

  const handleSendMessage = useCallback((e) => {
    e.preventDefault();
    if (!inputValue.trim() || !socketReady || rateLimitInfo) return;

    socketService.broadcastMessage(inputValue);
    setInputValue('');
    setTimeout(scrollToBottom, 50);
  }, [inputValue, socketReady, rateLimitInfo, scrollToBottom]);

  const handleMaximize = () => {
    setIsOpen(false);
    if (setView) {
      setView('global-chat');
    }
  };

  // Minimized button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600 shadow-lg hover:shadow-xl transition-all hover:scale-110"
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

  // Expanded chat widget
  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex w-[360px] flex-col rounded-2xl bg-[#12121a] border border-gray-800/50 shadow-2xl sm:w-[380px]"
      style={{ height: 'min(580px, calc(100vh - 60px))' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-2xl bg-[#12121a] border-b border-gray-800/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-blue-600">
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
          <button
            onClick={handleMaximize}
            className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
            aria-label="Maximize"
            title="Open full screen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
            aria-label="Minimize"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 bg-[#0a0a0f]">
        <div className="space-y-0.5">
          {messages.map((msg, i) => {
            const isOwn = msg.senderId === user.id;
            const prevMsg = messages[i - 1];
            const sameSender = prevMsg?.senderId === msg.senderId;

            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${
                  !sameSender && i > 0 ? 'mt-3' : 'mt-0.5'
                }`}
              >
                {/* Avatar for others */}
                {!isOwn && !sameSender && (
                  <div
                    className="mr-2 mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                    style={{ backgroundColor: getAvatarColor(msg.senderId) }}
                  >
                    {getInitials(msg.senderName)}
                  </div>
                )}
                {!isOwn && sameSender && <div className="mr-2 w-7 flex-shrink-0" />}

                <div className={`max-w-[75%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                  {/* Username for others on first message */}
                  {!isOwn && !sameSender && (
                    <p className="mb-0.5 text-[11px] font-medium text-purple-400 px-0.5">
                      {msg.senderName}
                    </p>
                  )}

                  {/* Message bubble */}
                  <div
                    className={`rounded-2xl px-3 py-1.5 text-sm ${
                      isOwn
                        ? 'rounded-br-md bg-gradient-to-br from-purple-600 to-blue-600 text-white'
                        : 'rounded-bl-md bg-[#1e1e2e] text-white'
                    }`}
                  >
                    <LinkifiedText text={msg.content} className="break-words leading-relaxed" />
                    <p className={`mt-0.5 text-[10px] ${isOwn ? 'text-purple-200/60' : 'text-gray-500'}`}>
                      {formatRelativeTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
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
            className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:hover:bg-purple-600 transition-colors"
            aria-label="Send"
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