import React, { useState, useEffect } from 'react';
import { Plus, Copy, Check, Swords, ExternalLink, AlertCircle, Trophy, Timer, XCircle, Award } from 'lucide-react';
import { PROBLEM_TAGS, DURATIONS } from '../utils/constants';
import socketService from '../services/socket.service';

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

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socketService.on('duel-created', (data) => {
      setDuel(data.duel);
      setMode('waiting');
      setError('');
    });

    socketService.on('match-found', (data) => {
      setDuel(null);
      setMode('menu');
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
    });

    socketService.on('error', (err) => {
      setError(err.message);
    });

    return () => {
      socketService.off('duel-created');
      socketService.off('match-found');
      socketService.off('error');
    };
  }, [socket, setActiveMatch, setMatchResult, setMatchTimer, setMatchAttempts]);

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
      socketService.off(`match-update-${matchId}`);
      socketService.off(`match-end-${matchId}`);
      socketService.off(`draw-offered-${matchId}`);
    };
  }, [activeMatch, socket, user.id, setActiveMatch, setMatchResult, setMatchTimer, setMatchAttempts]);

  // Match countdown timer
  useEffect(() => {
    let interval;
    if (activeMatch && matchTimer > 0) {
      interval = setInterval(() => {
        setMatchTimer((t) => Math.max(0, t - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeMatch, matchTimer, setMatchTimer]);

  // Auto-end match if timer reaches 0 and no match-end event received
  useEffect(() => {
    if (activeMatch && matchTimer === 0 && !matchResult) {
      console.log('⏰ Duel timer reached 0, waiting for backend...');
      
      const timeoutId = setTimeout(() => {
        console.log('❌ No match-end event received after 10 seconds, forcing draw');
        
        setMatchResult({
          won: false,
          draw: true,
          ratingChange: 0,
          newRating: user.rating,
          opponentRatingChange: 0,
          opponent: activeMatch.opponent,
          problem: activeMatch.match.problemName,
          problemRating: activeMatch.match.problemRating,
        });
        setActiveMatch(null);
        setMatchTimer(0);
        setError('Match timed out. The server may have had an issue. No rating changes applied.');
      }, 10000);

      return () => clearTimeout(timeoutId);
    }
  }, [activeMatch, matchTimer, matchResult, user.rating, setMatchResult, setActiveMatch, setMatchTimer, setError]);

  const handleCreateDuel = () => {
    if (!user.cfHandle) {
      setError('Please add your Codeforces handle in Profile before creating a duel');
      return;
    }

    if (formData.tags.length === 0) {
      setError('Please select at least one problem tag');
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

    socketService.joinDuel(joinCode);
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

  // Active Match View
  if (activeMatch) {
    const isPlayer1 = user.id === activeMatch.match.player1Id;
    const yourAttempts = isPlayer1 ? matchAttempts.player1 : matchAttempts.player2;
    const opponentAttempts = isPlayer1 ? matchAttempts.player2 : matchAttempts.player1;

    return (
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
    );
  }

  // Waiting for Opponent View
  if (mode === 'waiting' && duel) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-8 border border-purple-500/20">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Waiting for Opponent...
          </h2>
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
          <div className="bg-gray-700/50 rounded-lg p-4 text-sm text-gray-300">
            <p className="mb-1">Rating: {duel.ratingMin} - {duel.ratingMax}</p>
            <p className="mb-1">Duration: {duel.duration} minutes</p>
            <p>Tags: {duel.tags.join(', ')}</p>
          </div>
          <button
            onClick={() => {
              setMode('menu');
              setDuel(null);
            }}
            className="mt-6 w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
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
              onClick={() => setMode('menu')}
              className="text-gray-400 hover:text-white"
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
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
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
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
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
                    className={`px-4 py-2 rounded-lg transition ${
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
                Problem Tags ({formData.tags.length} selected)
              </label>
              <div className="flex flex-wrap gap-2">
                {PROBLEM_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition ${
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
              disabled={!user.cfHandle || formData.tags.length === 0}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition"
            >
              Create Duel
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
              onClick={() => setMode('menu')}
              className="text-gray-400 hover:text-white"
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
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-center text-2xl font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <button
            onClick={handleJoinDuel}
            disabled={!user.cfHandle || !joinCode.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition"
          >
            Join Duel
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

      <div className="grid md:grid-cols-2 gap-6">
        <button
          onClick={() => setMode('create')}
          className="group bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg p-8 text-left transition transform hover:scale-105"
        >
          <Plus className="w-12 h-12 text-white mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">Create Duel</h3>
          <p className="text-purple-100">
            Set up a custom match and get a shareable code for your friend
          </p>
        </button>

        <button
          onClick={() => setMode('join')}
          className="group bg-gradient-to-br from-pink-600 to-red-600 hover:from-pink-700 hover:to-red-700 rounded-lg p-8 text-left transition transform hover:scale-105"
        >
          <Swords className="w-12 h-12 text-white mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">Join Duel</h3>
          <p className="text-pink-100">
            Enter a duel code from your friend to start the battle
          </p>
        </button>
      </div>
    </div>
  );
}