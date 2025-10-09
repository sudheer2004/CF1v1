import React, { useState, useEffect, useRef } from 'react';
import { Users, Loader, Clock, AlertCircle } from 'lucide-react';
import socketService from '../services/socket.service';
import useMatchManager from '../hooks/useMatchManager';
import ActiveMatchView from './ActiveMatchView';
import MatchResultView from './MatchResultView';
import MatchSettingsForm, { isFormValid } from './MatchSettingsForm';

export default function Matchmaking({
  user, socket, socketReady, activeMatch, setActiveMatch,
  matchResult, setMatchResult, matchTimer, setMatchTimer,
  matchAttempts, setMatchAttempts
}) {
  const [inQueue, setInQueue] = useState(false);
  const [formData, setFormData] = useState({
    ratingMin: 800,
    ratingMax: 1600,
    tags: [],
    duration: 30,
  });
  const [queueTime, setQueueTime] = useState(0);
  const [error, setError] = useState('');
  const [isJoiningQueue, setIsJoiningQueue] = useState(false);
  const [isAcceptingDraw, setIsAcceptingDraw] = useState(false);

  const listenersRegistered = useRef(false);
  const queueStartTime = useRef(null);

  // Use shared match manager hook
  const {
    drawOffered,
    showDrawNotification,
    handleGiveUp,
    handleOfferDraw,
    handleAcceptDraw: originalHandleAcceptDraw,
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

  // Enhanced accept draw handler with loading state
  const handleAcceptDraw = () => {
    setIsAcceptingDraw(true);
    originalHandleAcceptDraw();
  };

  // Reset loading state when match result is set
  useEffect(() => {
    if (matchResult) {
      setIsAcceptingDraw(false);
    }
  }, [matchResult]);

  // Reset loading state when active match is cleared
  useEffect(() => {
    if (!activeMatch) {
      setIsAcceptingDraw(false);
    }
  }, [activeMatch]);

  // Setup matchmaking-specific socket listeners
  useEffect(() => {
    if (!socket || listenersRegistered.current) return;

    const handleQueueJoined = () => {
      setInQueue(true);
      setIsJoiningQueue(false);
      queueStartTime.current = Date.now();
      setError('');
    };

    const handleMatchFound = (data) => {
      console.log('🎮 Match found:', data);
      setInQueue(false);
      setIsJoiningQueue(false);
      queueStartTime.current = null;
      setQueueTime(0);
      
      // Validate that endTime exists before setting active match
      if (!data.match?.endTime) {
        console.error('❌ Match found but missing endTime:', data);
        setError('Invalid match data received. Please try again.');
        return;
      }
      
      // Convert endTime to timestamp if it's not already
      const endTimeMs = typeof data.match.endTime === 'number' 
        ? data.match.endTime 
        : new Date(data.match.endTime).getTime();
      
      console.log('✅ Setting active match with endTime:', endTimeMs);
      
      setActiveMatch({
        ...data,
        match: {
          ...data.match,
          endTime: endTimeMs
        }
      });
      setMatchResult(null);
      setMatchAttempts({ player1: 0, player2: 0 });
    };

    const handleError = (err) => {
      console.error('❌ Matchmaking error:', err.message);
      setError(err.message);
      setInQueue(false);
      setIsJoiningQueue(false);
      setIsAcceptingDraw(false);
      queueStartTime.current = null;
      setQueueTime(0);
    };

    socketService.on('queue-joined', handleQueueJoined);
    socketService.on('match-found', handleMatchFound);
    socketService.on('error', handleError);

    listenersRegistered.current = true;

    return () => {
      socketService.off('queue-joined', handleQueueJoined);
      socketService.off('match-found', handleMatchFound);
      socketService.off('error', handleError);
      listenersRegistered.current = false;
    };
  }, [socket, setActiveMatch, setMatchResult, setMatchAttempts]);

  // Enhanced queue timer with more accurate tracking
  useEffect(() => {
    let interval;
    if (inQueue && queueStartTime.current) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - queueStartTime.current) / 1000);
        setQueueTime(elapsed);
      }, 1000);
    } else if (!inQueue) {
      setQueueTime(0);
      queueStartTime.current = null;
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [inQueue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (inQueue) {
        socketService.leaveMatchmaking();
      }
    };
  }, [inQueue]);

  const handleJoinQueue = () => {
    if (!user.cfHandle) {
      setError('Please add your Codeforces handle in Profile before matchmaking');
      return;
    }

    if (!socketReady) {
      setError('Connection to server not ready. Please wait...');
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

    if (!isFormValid(formData)) {
      setError('Please check your match settings');
      return;
    }

    setIsJoiningQueue(true);
    setError('');
    socketService.joinMatchmaking(formData);
  };

  const handleLeaveQueue = () => {
    socketService.leaveMatchmaking();
    setInQueue(false);
    setQueueTime(0);
    queueStartTime.current = null;
    setIsJoiningQueue(false);
  };

  const handleNewMatch = () => {
    resetMatch();
    setError('');
    setIsAcceptingDraw(false);
    setQueueTime(0);
    queueStartTime.current = null;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Match Result View
  if (matchResult) {
    return (
      <MatchResultView
        matchResult={matchResult}
        error={error}
        onNewMatch={handleNewMatch}
        newMatchButtonText="Find New Match"
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
        isAcceptingDraw={isAcceptingDraw}
        matchTitle="Match in Progress"
      />
    );
  }

  // Queue View
  if (inQueue) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-8 border border-purple-500/20 text-center">
          <Loader className="w-16 h-16 text-purple-400 animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-4">Finding Opponent...</h2>
          <div className="flex items-center justify-center space-x-2 text-gray-300 mb-6">
            <Clock className="w-5 h-5" />
            <span className="text-xl font-mono">{formatTime(queueTime)}</span>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-gray-400 mb-2">Search Criteria:</p>
            <p className="text-white">
              Rating: {formData.ratingMin} - {formData.ratingMax}
            </p>
            <p className="text-white">Duration: {formData.duration} minutes</p>
            {formData.tags.length > 0 && (
              <p className="text-white">Tags: {formData.tags.join(', ')}</p>
            )}
          </div>
          <button
            onClick={handleLeaveQueue}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition"
          >
            Leave Queue
          </button>
        </div>
      </div>
    );
  }

  // Setup Form View
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-8 border border-purple-500/20">
        <h2 className="text-2xl font-bold text-white mb-6">Quick Matchmaking</h2>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {!socketReady && (
          <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg flex items-start space-x-3">
            <Loader className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5 animate-spin" />
            <p className="text-yellow-300">Connecting to server...</p>
          </div>
        )}

        <MatchSettingsForm
          formData={formData}
          setFormData={setFormData}
          disabled={isJoiningQueue || !socketReady}
        />

        <button
          onClick={handleJoinQueue}
          disabled={!user.cfHandle || !isFormValid(formData) || isJoiningQueue || activeMatch || !socketReady}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition flex items-center justify-center space-x-2"
        >
          {isJoiningQueue ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              <span>Joining Queue...</span>
            </>
          ) : !socketReady ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              <span>Connecting...</span>
            </>
          ) : activeMatch ? (
            <span>Complete Current Match First</span>
          ) : !isFormValid(formData) ? (
            <span>Invalid Settings</span>
          ) : (
            <>
              <Users className="w-5 h-5" />
              <span>{!user.cfHandle ? 'Add CF Handle First' : 'Join Queue'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}