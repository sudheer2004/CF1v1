import React from 'react';
import { Timer, ExternalLink, Loader } from 'lucide-react';
import ChatBubble from './ChatBubble';

/**
 * Shared component to display active match
 * Used by both Matchmaking and DuelMode
 */
export default function ActiveMatchView({
  user,
  activeMatch,
  matchTimer,
  matchAttempts,
  drawOffered,
  showDrawNotification,
  onGiveUp,
  onOfferDraw,
  onAcceptDraw,
  isAcceptingDraw = false,
  matchTitle = 'Match in Progress'
}) {
  const isPlayer1 = user.id === activeMatch.match.player1Id;
  const yourAttempts = isPlayer1 ? matchAttempts.player1 : matchAttempts.player2;
  const opponentAttempts = isPlayer1 ? matchAttempts.player2 : matchAttempts.player1;

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

  return (
    <>
      <div className="max-w-2xl mx-auto">
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg border border-purple-500/20 overflow-hidden">
          {/* Timer Header */}
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

          {/* Match Content */}
          <div className="p-8">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              {matchTitle}
            </h2>

            {/* Players */}
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

            {/* Problem Info */}
            <div className="bg-gray-700/50 rounded-lg p-6 mb-6">
              <p className="text-gray-300 mb-2">Problem</p>
              <p className="text-2xl font-bold text-white mb-2">
                {activeMatch.match.problemName}
              </p>
              <p className="text-gray-400">Rating: {activeMatch.match.problemRating}</p>
            </div>

            {/* Problem Link */}
            <a
              href={activeMatch.problemUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition font-medium mb-4"
            >
              <span>Open Problem on Codeforces</span>
              <ExternalLink className="w-5 h-5" />
            </a>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2 mt-6">
              <button
                onClick={onGiveUp}
                disabled={isAcceptingDraw}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm py-2 px-3 rounded-lg transition font-medium"
              >
                🏳️ Give Up
              </button>
              
              <button
                onClick={onOfferDraw}
                disabled={drawOffered.byMe || isAcceptingDraw}
                className={`${
                  drawOffered.byMe || isAcceptingDraw
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-yellow-600 hover:bg-yellow-700'
                } text-white text-sm py-2 px-3 rounded-lg transition font-medium`}
              >
                {drawOffered.byMe ? '⏳ Offered' : '🤝 Offer Draw'}
              </button>
              
              <button
                onClick={onAcceptDraw}
                disabled={!drawOffered.byOpponent || isAcceptingDraw}
                className={`${
                  isAcceptingDraw
                    ? 'bg-blue-600 cursor-wait'
                    : drawOffered.byOpponent
                    ? 'bg-green-600 hover:bg-green-700 animate-pulse'
                    : 'bg-gray-600 cursor-not-allowed'
                } text-white text-sm py-2 px-3 rounded-lg transition font-medium flex items-center justify-center space-x-1`}
              >
                {isAcceptingDraw ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Accepting...</span>
                  </>
                ) : (
                  <span>✓ Accept Draw</span>
                )}
              </button>
            </div>

            {drawOffered.byMe && !drawOffered.byOpponent && (
              <p className="text-gray-400 text-xs mt-2 text-center">
                Waiting for opponent to accept draw...
              </p>
            )}

            {isAcceptingDraw && (
              <p className="text-blue-400 text-xs mt-2 text-center animate-pulse">
                Processing draw acceptance...
              </p>
            )}

            <p className="text-gray-400 text-sm mt-4 text-center">
              Solve and submit on Codeforces. We're tracking your submissions!
            </p>
          </div>
        </div>
      </div>

      {/* Chat Bubble - Fully Integrated */}
      <ChatBubble 
        matchId={activeMatch.match.id}
        user={user}
      />
    </>
  );
}