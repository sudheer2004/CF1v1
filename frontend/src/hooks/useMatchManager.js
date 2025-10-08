import { useState, useEffect, useRef } from 'react';
import socketService from '../services/socket.service';

/**
 * Custom hook to manage match state and socket events
 * Shared between Matchmaking and DuelMode components
 */
export default function useMatchManager({
  user,
  socket,
  activeMatch,
  setActiveMatch,
  matchResult,
  setMatchResult,
  matchTimer,
  setMatchTimer,
  matchAttempts,
  setMatchAttempts
}) {
  const [drawOffered, setDrawOffered] = useState({ byMe: false, byOpponent: false });
  const [showDrawNotification, setShowDrawNotification] = useState(false);
  const listenersRegistered = useRef(false);

  // Setup match-specific event listeners
  useEffect(() => {
    if (!activeMatch || !socket || listenersRegistered.current) return;

    const matchId = activeMatch.match.id;

    const handleMatchUpdate = (data) => {
      console.log('📊 Match update received:', data);
      setMatchAttempts({
        player1: data.player1Attempts,
        player2: data.player2Attempts,
      });
    };

    const handleMatchEnd = (data) => {
      console.log('🏁 Match end received:', data);
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
      
      setTimeout(() => setShowDrawNotification(false), 5000);
    };

    console.log('👂 Listening for match events:', matchId);
    socketService.on(`match-update-${matchId}`, handleMatchUpdate);
    socketService.on(`match-end-${matchId}`, handleMatchEnd);
    socketService.on(`draw-offered-${matchId}`, handleDrawOffered);

    listenersRegistered.current = true;

    return () => {
      console.log('🧹 Cleaning up match event listeners:', matchId);
      socketService.off(`match-update-${matchId}`, handleMatchUpdate);
      socketService.off(`match-end-${matchId}`, handleMatchEnd);
      socketService.off(`draw-offered-${matchId}`, handleDrawOffered);
      listenersRegistered.current = false;
    };
  }, [activeMatch, socket, user.id, setActiveMatch, setMatchResult, setMatchTimer, setMatchAttempts]);

  // Match actions
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

  const handleNewMatch = () => {
    setMatchResult(null);
  };

  return {
    drawOffered,
    showDrawNotification,
    handleGiveUp,
    handleOfferDraw,
    handleAcceptDraw,
    handleNewMatch,
  };
}