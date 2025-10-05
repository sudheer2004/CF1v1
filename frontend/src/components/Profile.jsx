import React, { useState, useEffect } from 'react';
import { User, Edit, Save, X, Clock, Trophy, TrendingUp, Loader } from 'lucide-react';
import { getRatingColor, getRatingBadge } from '../utils/constants';
import api from '../services/api.service';

export default function Profile({ user, setUser }) {
  const [editing, setEditing] = useState(false);
  const [cfHandle, setCfHandle] = useState(user.cfHandle || '');
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadMatchHistory();
  }, []);

  const loadMatchHistory = async () => {
    try {
      setMatchesLoading(true);
      const response = await api.getMatchHistory('me', 20, 0);
      setMatches(response.data.matches);
    } catch (err) {
      console.error('Failed to load matches:', err);
    } finally {
      setMatchesLoading(false);
    }
  };

  const handleUpdateCfHandle = async () => {
    if (!cfHandle.trim()) {
      setError('CF Handle cannot be empty');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await api.updateCfHandle(cfHandle);
      setUser({ ...user, cfHandle: response.data.user.cfHandle });
      setSuccess('Codeforces handle updated successfully!');
      setEditing(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const winRate = user.totalMatches > 0 
    ? ((user.wins / user.totalMatches) * 100).toFixed(1) 
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-8 border border-purple-500/20">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
              <User className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{user.username}</h1>
              <p className="text-gray-400">{user.email}</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-4xl font-bold ${getRatingColor(user.rating)}`}>
              {user.rating}
            </p>
            <p className="text-gray-400 text-sm">{getRatingBadge(user.rating)}</p>
          </div>
        </div>

        {/* CF Handle Section */}
        <div className="border-t border-gray-700 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">Codeforces Handle</h3>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center space-x-2 text-purple-400 hover:text-purple-300"
              >
                <Edit className="w-4 h-4" />
                <span>Edit</span>
              </button>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-300 text-sm">
              {success}
            </div>
          )}

          {editing ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={cfHandle}
                onChange={(e) => setCfHandle(e.target.value)}
                placeholder="Enter your CF handle"
                className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={handleUpdateCfHandle}
                disabled={loading}
                className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition"
              >
                <Save className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setCfHandle(user.cfHandle || '');
                  setError('');
                }}
                className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          ) : (
            <p className="text-lg text-purple-400">
              {user.cfHandle || 'Not set (required for matches)'}
            </p>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-6 border border-purple-500/20">
          <Trophy className="w-8 h-8 text-green-400 mb-2" />
          <p className="text-3xl font-bold text-white">{user.wins}</p>
          <p className="text-gray-400 text-sm">Wins</p>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-6 border border-purple-500/20">
          <TrendingUp className="w-8 h-8 text-red-400 mb-2" />
          <p className="text-3xl font-bold text-white">{user.losses}</p>
          <p className="text-gray-400 text-sm">Losses</p>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-6 border border-purple-500/20">
          <Clock className="w-8 h-8 text-yellow-400 mb-2" />
          <p className="text-3xl font-bold text-white">{user.draws}</p>
          <p className="text-gray-400 text-sm">Draws</p>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-6 border border-purple-500/20">
          <Trophy className="w-8 h-8 text-purple-400 mb-2" />
          <p className="text-3xl font-bold text-white">{winRate}%</p>
          <p className="text-gray-400 text-sm">Win Rate</p>
        </div>
      </div>

      {/* Match History */}
      <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg border border-purple-500/20">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Match History</h2>
        </div>

        {matchesLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        ) : matches.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            No matches played yet
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {matches.map((match) => {
              const isPlayer1 = match.player1Id === user.id;
              const opponent = isPlayer1 ? match.player2 : match.player1;
              const won = match.winnerId === user.id;
              const draw = match.winnerId === null;
              const ratingChange = isPlayer1 
                ? match.player1RatingChange 
                : match.player2RatingChange;

              return (
                <div key={match.id} className="px-6 py-4 hover:bg-gray-700/30 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            won
                              ? 'bg-green-500/20 text-green-400'
                              : draw
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {won ? 'Victory' : draw ? 'Draw' : 'Defeat'}
                        </span>
                        <span className="text-gray-400 text-sm">
                          vs {opponent.username}
                        </span>
                      </div>
                      <p className="text-white font-medium mb-1">{match.problemName}</p>
                      <p className="text-gray-400 text-sm">
                        Rating: {match.problemRating} • Duration: {match.duration}min
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-2xl font-bold ${
                          ratingChange > 0
                            ? 'text-green-400'
                            : ratingChange < 0
                            ? 'text-red-400'
                            : 'text-gray-400'
                        }`}
                      >
                        {ratingChange > 0 ? '+' : ''}{ratingChange}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {new Date(match.endTime).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}