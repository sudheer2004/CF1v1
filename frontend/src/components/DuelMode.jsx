import React, { useState, useEffect, useRef } from 'react';
import { Plus, Copy, Check, Swords, AlertCircle, Loader } from 'lucide-react';
import socketService from '../services/socket.service';
import useMatchManager from '../hooks/useMatchManager';
import ActiveMatchView from './ActiveMatchView';
import MatchResultView from './MatchResultView';
import MatchSettingsForm, { isFormValid } from './MatchSettingsForm';

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

  const listenersRegistered = useRef(false);
  const currentDuelCode = useRef(null);

  // Use shared match manager hook
  const {
    drawOffered,
    showDrawNotification,
    handleGiveUp,
    handleOfferDraw,
    handleAcceptDraw,
    handleNewMatch: resetMatch,
  } = useMatchManager({
    user,
    socket,
    activeMatch,
    setActiveMatch,
    matchResult,
    setMatchResult,
    matchTimer,
    setMatchTimer,
    matchAttempts,
    setMatchAttempts,
  });

  // Setup duel-specific socket listeners
  useEffect(() => {
    if (!socket || listenersRegistered.current) return;

    console.log('🎧 Setting up Duel Mode socket listeners');

    const handleDuelCreated = (data) => {
      console.log('✅ Duel created event received:', data.duel.duelCode);
      
      if (currentDuelCode.current !== data.duel.duelCode) {
        currentDuelCode.current = data.duel.duelCode;
        setDuel(data.duel);
        setMode('waiting');
        setIsCreatingDuel(false);
        setError('');
        setWaitingForMatch(false);
      }
    };

    const handleMatchFound = (data) => {
      console.log('🎮 Match found event received in DuelMode');
      
      setWaitingForMatch(false);
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
      
      const timeout = setTimeout(() => {
        if (waitingForMatch) {
          console.log('⚠️ Still waiting for match after 10 seconds');
          setError('Taking longer than expected. Please wait or try refreshing if this persists.');
        }
      }, 10000);

      return () => clearTimeout(timeout);
    }
  }, [mode, duel, waitingForMatch]);

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

  const copyDuelCode = () => {
    if (duel) {
      navigator.clipboard.writeText(duel.duelCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNewMatch = () => {
    resetMatch();
    setError('');
  };

  const handleCancelDuel = () => {
    setMode('menu');
    setDuel(null);
    currentDuelCode.current = null;
    setError('');
    setWaitingForMatch(false);
  };

  // Match Result View
  if (matchResult) {
    return (
      <MatchResultView
        matchResult={matchResult}
        error={error}
        onNewMatch={handleNewMatch}
        newMatchButtonText="Create New Duel"
      />
    );
  }

  // Active Match View
  if (activeMatch) {
    return (
      <ActiveMatchView
        user={user}
        activeMatch={activeMatch}
        matchTimer={matchTimer}
        matchAttempts={matchAttempts}
        drawOffered={drawOffered}
        showDrawNotification={showDrawNotification}
        onGiveUp={handleGiveUp}
        onOfferDraw={handleOfferDraw}
        onAcceptDraw={handleAcceptDraw}
        matchTitle="Duel in Progress"
      />
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

          <MatchSettingsForm
            formData={formData}
            setFormData={setFormData}
            disabled={isCreatingDuel}
          />

          <button
            onClick={handleCreateDuel}
            disabled={!user.cfHandle || !isFormValid(formData) || isCreatingDuel}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition flex items-center justify-center space-x-2"
          >
            {isCreatingDuel ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Creating Duel...</span>
              </>
            ) : !isFormValid(formData) ? (
              <span>Invalid Settings</span>
            ) : (
              <span>Create Duel</span>
            )}
          </button>
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