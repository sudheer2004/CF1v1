import React from 'react';
import { Trophy, Award, XCircle } from 'lucide-react';

/**
 * Shared component to display match results
 * Used by both Matchmaking and DuelMode
 */
export default function MatchResultView({
  matchResult,
  error,
  onNewMatch,
  newMatchButtonText = 'Find New Match'
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className={`rounded-lg p-8 border-2 ${
        matchResult.won
          ? 'bg-green-500/10 border-green-500'
          : matchResult.draw
          ? 'bg-gray-500/10 border-gray-500'
          : 'bg-red-500/10 border-red-500'
      }`}>
        {/* Result Icon & Title */}
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

        {/* Rating Changes */}
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

        {/* Problem Info */}
        <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
          <p className="text-gray-400 text-sm mb-1">Problem</p>
          <p className="text-lg font-bold text-white">{matchResult.problem}</p>
          <p className="text-gray-400 text-sm">Rating: {matchResult.problemRating}</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
            <p className="text-yellow-300 text-sm">{error}</p>
          </div>
        )}

        {/* New Match Button */}
        <button
          onClick={onNewMatch}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition"
        >
          {newMatchButtonText}
        </button>
      </div>
    </div>
  );
}