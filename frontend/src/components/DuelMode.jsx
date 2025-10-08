import React, { useState, useEffect, useRef } from 'react';
import { Plus, Copy, Check, Swords, ExternalLink, AlertCircle, Trophy, Timer, XCircle, Award, Loader } from 'lucide-react';
import { PROBLEM_TAGS, DURATIONS } from '../utils/constants';
import socketService from '../services/socket.service';
import ChatBubble from './ChatBubble';

export default function DuelMode({
  user, socket, activeMatch, setActiveMatch,
  matchResult, setMatchResult, matchTimer, setMatchTimer,
  matchAttempts, setMatchAttempts
}) {
  const [mode, setMode] = useState('menu');
  const [duel, setDuel] = useState(null);
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [isCreatingDuel, setIsCreatingDuel] = useState(false);
  const [isJoiningDuel, setIsJoiningDuel] = useState(false);
  const [waitingForMatch, setWaitingForMatch] = useState(false);
  const [formData, setFormData] = useState({
    ratingMin: 800,
    ratingMax: 1600,
    tags: [],
    duration: 30,
  });
  const [drawOffered, setDrawOffered] = useState({
    byMe: false,
    byOpponent: false
  });
  const [showDrawNotification, setShowDrawNotification] = useState(false);

  // Use refs to prevent duplicate event listeners
  const listenersRegistered = useRef(false);
  const currentDuelCode = useRef(null);

  // Socket event listeners - Set up ONCE
  useEffect(() => {
    if (!socket || listenersRegistered.current) return;

    console.log('🎧 Setting up Duel Mode socket listeners');

    const handleDuelCreated = (data) => {
      console.log('✅ Duel created event received:', data.duel.duelCode);
      
      // Only update if this is a new duel
      if (currentDuelCode.current !== data.duel.duelCode) {
        currentDuelCode.current = data.duel.duelCode;
        setDuel(data.duel);
        setMode('waiting');
        setIsCreatingDuel(false);
        setError('');
        setWaitingForMatch(false); // Reset waiting flag
      }
    };

    const handleMatchFound = (data) => {
      console.log('🎮 Match found event received in DuelMode');
      
      // Clear waiting state immediately
      setWaitingForMatch(false);
      
      // Clear duel state
      setDuel(null);
      currentDuelCode.current = null;
      setMode('menu');
      setIsJoiningDuel(false);
      setIsCreatingDuel(false);
      
      const matchDuration = data.match.duration * 60;
      setActiveMatch({
        ...data,
        startTime: Date.now(),
        matchDuration: matchDuration,
      });
      setMatchTimer(matchDuration);
      setMatchResult(null);
      setMatchAttempts({ player1: 0, player2: 0 });
      setDrawOffered({ byMe: false, byOpponent: false });
      setShowDrawNotification(false);
      
      console.log('✅ DuelMode: Match state updated');
    };

    const handleError = (err) => {
      console.error('❌ Socket error:', err.message);
      setError(err.message);
      setIsCreatingDuel(false);
      setIsJoiningDuel(false);
      setWaitingForMatch(false);
    };

    socketService.on('duel-created', handleDuelCreated);
    socketService.on('match-found', handleMatchFound);
    socketService.on('error', handleError);

    listenersRegistered.current = true;

    return () => {
      console.log('🧹 Cleaning up Duel Mode socket listeners');
      socketService.off('duel-created', handleDuelCreated);
      socketService.off('match-found', handleMatchFound);
      socketService.off('error', handleError);
      listenersRegistered.current = false;
    };
  }, [socket, setActiveMatch, setMatchResult, setMatchTimer, setMatchAttempts]);

  // Monitor when someone joins the duel
  useEffect(() => {
    if (mode === 'waiting' && duel) {
      console.log('⏳ Waiting for opponent to join duel:', duel.duelCode);
      setWaitingForMatch(true);
      
      // Set a timeout to show a warning if match doesn't start
      const timeout = setTimeout(() => {
        if (waitingForMatch) {
          console.log('⚠️ Still waiting for match after 10 seconds');
          setError('Taking longer than expected. Please wait or try refreshing if this persists.');
        }
      }, 10000);

      return () => clearTimeout(timeout);
    }
  }, [mode, duel, waitingForMatch]);

  // Listen to match-specific events when match is active
  useEffect(() => {
    if (!activeMatch || !socket) return;

    const matchId = activeMatch.match.id;

    const handleMatchUpdate = (data) => {
      console.log('📊 Duel match update received:', data);
      setMatchAttempts({
        player1: data.player1Attempts,
        player2: data.player2Attempts,
      });
    };

    const handleMatchEnd = (data) => {
      console.log('🏁 Duel match end received:', data);
      const isPlayer1 = user.id === activeMatch.match.player1Id;
      const won = data.winnerId === user.id;
      const draw = data.winnerId === null;

      setMatchResult({
        won,
        draw,
        ratingChange: isPlayer1 ? data.player1RatingChange : data.player2RatingChange,
        newRating: isPlayer1 ? data.player1NewRating : data.player2NewRating,
        opponentRatingChange: isPlayer1 ? data.player2RatingChange : data.player1RatingChange,
        opponent: activeMatch.opponent,
        problem: activeMatch.match.problemName,
        problemRating: activeMatch.match.problemRating,
      });
      setActiveMatch(null);
      setMatchTimer(0);
      setDrawOffered({ byMe: false, byOpponent: false });
      setShowDrawNotification(false);
    };

    const handleDrawOffered = (data) => {
      console.log('🤝 Draw offered by opponent');
      setDrawOffered(prev => ({ ...prev, byOpponent: true }));
      setShowDrawNotification(true);
      
      // Auto-hide notification after 5 seconds
      setTimeout(() => setShowDrawNotification(false), 5000);
    };

    console.log('👂 Listening for duel match events:', matchId);
    socketService.on(`match-update-${matchId}`, handleMatchUpdate);
    socketService.on(`match-end-${matchId}`, handleMatchEnd);
    socketService.on(`draw-offered-${matchId}`, handleDrawOffered);

    return () => {
      socketService.off(`match-update-${matchId}`, handleMatchUpdate);
      socketService.off(`match-end-${matchId}`, handleMatchEnd);
      socketService.off(`draw-offered-${matchId}`, handleDrawOffered);
    };
  }, [activeMatch, socket, user.id, setActiveMatch, setMatchResult, setMatchTimer, setMatchAttempts]);

  // Match countdown timer
 

  // Auto-end match if timer reaches 0 and no match-end event received
 
  const handleCreateDuel = () => {
    if (!user.cfHandle) {
      setError('Please add your Codeforces handle in Profile before creating a duel');
      return;
    }

    if (formData.ratingMin < 800 || formData.ratingMax > 3500) {
      setError('Rating must be between 800 and 3500');
      return;
    }

    if (formData.ratingMin > formData.ratingMax) {
      setError('Minimum rating cannot be greater than maximum rating');
      return;
    }

    setIsCreatingDuel(true);
    setError('');
    socketService.createDuel(formData);
  };

  const handleJoinDuel = () => {
    if (!user.cfHandle) {
      setError('Please add your Codeforces handle in Profile before joining a duel');
      return;
    }

    if (!joinCode.trim()) {
      setError('Please enter a duel code');
      return;
    }

    setIsJoiningDuel(true);
    setError('');
    socketService.joinDuel(joinCode.trim());
  };

  const handleTagToggle = (tag) => {
    setFormData({
      ...formData,
      tags: formData.tags.includes(tag)
        ? formData.tags.filter((t) => t !== tag)
        : [...formData.tags, tag],
    });
  };

  const copyDuelCode = () => {
    if (duel) {
      navigator.clipboard.writeText(duel.duelCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNewMatch = () => {
    setMatchResult(null);
    setError('');
  };

  const handleCancelDuel = () => {
    setMode('menu');
    setDuel(null);
    currentDuelCode.current = null;
    setError('');
    setWaitingForMatch(false);
  };

  const handleGiveUp = () => {
    if (window.confirm('Are you sure you want to give up? You will lose the match.')) {
      socketService.giveUp(activeMatch.match.id);
    }
  };

  const handleOfferDraw = () => {
    socketService.offerDraw(activeMatch.match.id);
    setDrawOffered(prev => ({ ...prev, byMe: true }));
  };

  const handleAcceptDraw = () => {
    socketService.acceptDraw(activeMatch.match.id);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (matchTimer > 300) return 'text-green-400';
    if (matchTimer > 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Match Result View
  if (matchResult) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className={`rounded-lg p-8 border-2 ${
          matchResult.won 
            ? 'bg-green-500/10 border-green-500' 
            : matchResult.draw 
            ? 'bg-gray-500/10 border-gray-500'
            : 'bg-red-500/10 border-red-500'
        }`}>
          <div className="text-center mb-6">
            <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
              matchResult.won 
                ? 'bg-green-500' 
                : matchResult.draw 
                ? 'bg-gray-500'
                : 'bg-red-500'
            }`}>
              {matchResult.won ? (
                <Trophy className="w-10 h-10 text-white" />
              ) : matchResult.draw ? (
                <Award className="w-10 h-10 text-white" />
              ) : (
                <XCircle className="w-10 h-10 text-white" />
              )}
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">
              {matchResult.won ? 'Victory!' : matchResult.draw ? 'Draw!' : 'Defeat'}
            </h2>
            <p className="text-gray-400">
              {matchResult.won 
                ? 'You solved the problem first!' 
                : matchResult.draw 
                ? 'Match ended in a draw'
                : 'Your opponent solved the problem first'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-800/50 rounded-lg p-4 text-center">
              <p className="text-gray-400 text-sm mb-1">Your Rating</p>
              <p className="text-2xl font-bold text-white">{matchResult.newRating}</p>
              <p className={`text-sm font-medium ${
                matchResult.ratingChange >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {matchResult.ratingChange >= 0 ? '+' : ''}{matchResult.ratingChange}
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 text-center">
              <p className="text-gray-400 text-sm mb-1">Opponent</p>
              <p className="text-xl font-bold text-white">{matchResult.opponent.username}</p>
              <p className={`text-sm font-medium ${
                matchResult.opponentRatingChange >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {matchResult.opponentRatingChange >= 0 ? '+' : ''}{matchResult.opponentRatingChange}
              </p>
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
            <p className="text-gray-400 text-sm mb-1">Problem</p>
            <p className="text-lg font-bold text-white">{matchResult.problem}</p>
            <p className="text-gray-400 text-sm">Rating: {matchResult.problemRating}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
              <p className="text-yellow-300 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleNewMatch}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition"
          >
            Create New Duel
          </button>
        </div>
      </div>
    );
  }

  // Active Match View - CHAT ONLY APPEARS HERE
  if (activeMatch) {
    const isPlayer1 = user.id === activeMatch.match.player1Id;
    const yourAttempts = isPlayer1 ? matchAttempts.player1 : matchAttempts.player2;
    const opponentAttempts = isPlayer1 ? matchAttempts.player2 : matchAttempts.player1;

    return (
      <>
        <div className="max-w-2xl mx-auto">
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg border border-purple-500/20 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4">
              <div className="flex items-center justify-center space-x-3">
                <Timer className={`w-6 h-6 ${getTimerColor()}`} />
                <span className={`text-3xl font-mono font-bold ${getTimerColor()}`}>
                  {formatTime(matchTimer)}
                </span>
              </div>
              <p className="text-center text-white/80 text-sm mt-1">Time Remaining</p>
            </div>

            {/* Draw Notification */}
            {showDrawNotification && drawOffered.byOpponent && (
              <div className="bg-blue-500/20 border-b border-blue-500/50 p-3 animate-pulse">
                <p className="text-blue-300 text-center text-sm font-medium">
                  🤝 Opponent is offering a draw! Click "Accept Draw" to agree.
                </p>
              </div>
            )}

            <div className="p-8">
              <h2 className="text-2xl font-bold text-white mb-6 text-center">
                Duel in Progress
              </h2>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-gray-400 text-sm mb-1">You</p>
                  <p className="text-xl font-bold text-white">{user.username}</p>
                  <p className="text-gray-400 text-sm">Attempts: {yourAttempts}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-gray-400 text-sm mb-1">Opponent</p>
                  <p className="text-xl font-bold text-purple-400">
                    {activeMatch.opponent.username}
                  </p>
                  <p className="text-gray-400 text-sm">Attempts: {opponentAttempts}</p>
                </div>
              </div>

              <div className="bg-gray-700/50 rounded-lg p-6 mb-6">
                <p className="text-gray-300 mb-2">Problem</p>
                <p className="text-2xl font-bold text-white mb-2">
                  {activeMatch.match.problemName}
                </p>
                <p className="text-gray-400">Rating: {activeMatch.match.problemRating}</p>
              </div>

              <a
                href={activeMatch.problemUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition font-medium mb-4"
              >
                <span>Open Problem on Codeforces</span>
                <ExternalLink className="w-5 h-5" />
              </a>

              {/* Match Action Buttons */}
              <div className="grid grid-cols-3 gap-2 mt-6">
                <button
                  onClick={handleGiveUp}
                  className="bg-red-600 hover:bg-red-700 text-white text-sm py-2 px-3 rounded-lg transition font-medium"
                >
                  🏳️ Give Up
                </button>
                
                <button
                  onClick={handleOfferDraw}
                  disabled={drawOffered.byMe}
                  className={`${
                    drawOffered.byMe
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-yellow-600 hover:bg-yellow-700'
                  } text-white text-sm py-2 px-3 rounded-lg transition font-medium`}
                >
                  {drawOffered.byMe ? '⏳ Offered' : '🤝 Offer Draw'}
                </button>
                
                <button
                  onClick={handleAcceptDraw}
                  disabled={!drawOffered.byOpponent}
                  className={`${
                    drawOffered.byOpponent
                      ? 'bg-green-600 hover:bg-green-700 animate-pulse'
                      : 'bg-gray-600 cursor-not-allowed'
                  } text-white text-sm py-2 px-3 rounded-lg transition font-medium`}
                >
                  ✓ Accept Draw
                </button>
              </div>

              {drawOffered.byMe && !drawOffered.byOpponent && (
                <p className="text-gray-400 text-xs mt-2 text-center">
                  Waiting for opponent to accept draw...
                </p>
              )}

              <p className="text-gray-400 text-sm mt-4 text-center">
                Solve and submit on Codeforces. We're tracking your submissions!
              </p>
            </div>
          </div>
        </div>

        {/* Chat Bubble - ONLY during active match */}
        <ChatBubble 
          matchId={activeMatch.match.id} 
          user={user} 
        />
      </>
    );
  }

  // Waiting for Opponent View with improved status
  if (mode === 'waiting' && duel) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-8 border border-purple-500/20">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Waiting for Opponent...
          </h2>
          
          {/* Visual indicator */}
          <div className="flex items-center justify-center mb-6">
            <Loader className="w-12 h-12 text-purple-400 animate-spin" />
          </div>

          <div className="bg-gray-700/50 rounded-lg p-6 mb-6">
            <p className="text-gray-400 text-sm mb-2">Share this code with your friend:</p>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-900 px-4 py-3 rounded-lg">
                <p className="text-3xl font-mono font-bold text-purple-400 text-center">
                  {duel.duelCode}
                </p>
              </div>
              <button
                onClick={copyDuelCode}
                className="p-3 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
              >
                {copied ? (
                  <Check className="w-6 h-6 text-white" />
                ) : (
                  <Copy className="w-6 h-6 text-white" />
                )}
              </button>
            </div>
          </div>

          <div className="bg-gray-700/50 rounded-lg p-4 text-sm text-gray-300 mb-6">
            <p className="mb-1">Rating: {duel.ratingMin} - {duel.ratingMax}</p>
            <p className="mb-1">Duration: {duel.duration} minutes</p>
            <p>Tags: {duel.tags.length > 0 ? duel.tags.join(', ') : 'Any'}</p>
          </div>

          {/* Status message */}
          {waitingForMatch && (
            <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-3 mb-4">
              <p className="text-blue-300 text-sm text-center">
                🔄 Listening for opponent... The match will start automatically when they join.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 mb-4">
              <p className="text-yellow-300 text-sm text-center">{error}</p>
            </div>
          )}

          <button
            onClick={handleCancelDuel}
            className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
          >
            Cancel Duel
          </button>
        </div>
      </div>
    );
  }

  // Create Duel Form
  if (mode === 'create') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-8 border border-purple-500/20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Create Custom Duel</h2>
            <button
              onClick={() => {
                setMode('menu');
                setError('');
              }}
              disabled={isCreatingDuel}
              className="text-gray-400 hover:text-white disabled:opacity-50"
            >
              Back
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Min Rating</label>
                <input
                  type="number"
                  value={formData.ratingMin}
                  onChange={(e) =>
                    setFormData({ ...formData, ratingMin: parseInt(e.target.value) })
                  }
                  min="800"
                  max="3500"
                  step="100"
                  disabled={isCreatingDuel}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Max Rating</label>
                <input
                  type="number"
                  value={formData.ratingMax}
                  onChange={(e) =>
                    setFormData({ ...formData, ratingMax: parseInt(e.target.value) })
                  }
                  min="800"
                  max="3500"
                  step="100"
                  disabled={isCreatingDuel}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-white font-medium mb-3">Duration</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {DURATIONS.map((dur) => (
                  <button
                    key={dur.value}
                    onClick={() => setFormData({ ...formData, duration: dur.value })}
                    disabled={isCreatingDuel}
                    className={`px-4 py-2 rounded-lg transition disabled:opacity-50 ${
                      formData.duration === dur.value
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {dur.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-white font-medium mb-3">
                Problem Tags ({formData.tags.length} selected) - Optional
              </label>
              <div className="flex flex-wrap gap-2">
                {PROBLEM_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    disabled={isCreatingDuel}
                    className={`px-3 py-1.5 rounded-lg text-sm transition disabled:opacity-50 ${
                      formData.tags.includes(tag)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreateDuel}
              disabled={!user.cfHandle || isCreatingDuel}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition flex items-center justify-center space-x-2"
            >
              {isCreatingDuel ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>Creating Duel...</span>
                </>
              ) : (
                <span>Create Duel</span>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Join Duel Form
  if (mode === 'join') {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-8 border border-purple-500/20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Join Duel</h2>
            <button
              onClick={() => {
                setMode('menu');
                setError('');
                setJoinCode('');
              }}
              disabled={isJoiningDuel}
              className="text-gray-400 hover:text-white disabled:opacity-50"
            >
              Back
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300">{error}</p>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-white font-medium mb-3">Enter Duel Code</label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g., ABCD1234"
              maxLength={8}
              disabled={isJoiningDuel}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-center text-2xl font-mono focus:outline-none focus:border-purple-500 disabled:opacity-50"
            />
          </div>

          <button
            onClick={handleJoinDuel}
            disabled={!user.cfHandle || !joinCode.trim() || isJoiningDuel}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition flex items-center justify-center space-x-2"
          >
            {isJoiningDuel ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Joining Duel...</span>
              </>
            ) : (
              <span>Join Duel</span>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Main Menu
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <Swords className="w-16 h-16 text-purple-400 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-white mb-2">Duel Mode</h1>
        <p className="text-gray-400">Challenge your friends to epic coding battles</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300">{error}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <button
          onClick={() => {
            setMode('create');
            setError('');
          }}
          disabled={activeMatch}
          className="group bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg p-8 text-left transition transform hover:scale-105 disabled:hover:scale-100"
        >
          <Plus className="w-12 h-12 text-white mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">Create Duel</h3>
          <p className="text-purple-100">
            Set up a custom match and get a shareable code for your friend
          </p>
          {activeMatch && (
            <p className="text-yellow-300 text-sm mt-2">
              ⚠️ Complete your current match first
            </p>
          )}
        </button>

        <button
          onClick={() => {
            setMode('join');
            setError('');
            setJoinCode('');
          }}
          disabled={activeMatch}
          className="group bg-gradient-to-br from-pink-600 to-red-600 hover:from-pink-700 hover:to-red-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg p-8 text-left transition transform hover:scale-105 disabled:hover:scale-100"
        >
          <Swords className="w-12 h-12 text-white mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">Join Duel</h3>
          <p className="text-pink-100">
            Enter a duel code from your friend to start the battle
          </p>
          {activeMatch && (
            <p className="text-yellow-300 text-sm mt-2">
              ⚠️ Complete your current match first
            </p>
          )}
        </button>
      </div>
    </div>
  );
}