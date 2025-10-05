import React, { useState, useEffect } from 'react';
import { Award, Trophy, TrendingUp, Loader } from 'lucide-react';
import { getRatingColor, getRatingBadge } from '../utils/constants';
import api from '../services/api.service';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await api.getLeaderboard(100, 0);
      setLeaderboard(response.data.leaderboard);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-400" />;
    if (rank === 2) return <Award className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Award className="w-6 h-6 text-orange-400" />;
    return <span className="text-gray-400 font-bold">{rank}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader className="w-12 h-12 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6 text-center">
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <Award className="w-16 h-16 text-purple-400 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-white mb-2">Global Leaderboard</h1>
        <p className="text-gray-400">Top players competing worldwide</p>
      </div>

      <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg border border-purple-500/20 overflow-hidden">
        {/* Header */}
        <div className="bg-gray-900/50 px-6 py-4 border-b border-gray-700">
          <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-400">
            <div className="col-span-1">Rank</div>
            <div className="col-span-4">Player</div>
            <div className="col-span-2 text-center">Rating</div>
            <div className="col-span-2 text-center">Matches</div>
            <div className="col-span-3 text-center">W / L / D</div>
          </div>
        </div>

        {/* Leaderboard Entries */}
        <div className="divide-y divide-gray-700">
          {leaderboard.map((player) => {
            const winRate = player.totalMatches > 0 
              ? ((player.wins / player.totalMatches) * 100).toFixed(0) 
              : 0;

            return (
              <div
                key={player.id}
                className="px-6 py-4 hover:bg-gray-700/30 transition"
              >
                <div className="grid grid-cols-12 gap-4 items-center">
                  {/* Rank */}
                  <div className="col-span-1 flex items-center justify-center">
                    {getRankIcon(player.rank)}
                  </div>

                  {/* Player Info */}
                  <div className="col-span-4">
                    <p className="text-white font-medium">{player.username}</p>
                    {player.cfHandle && (
                      <p className="text-gray-400 text-sm">@{player.cfHandle}</p>
                    )}
                  </div>

                  {/* Rating */}
                  <div className="col-span-2 text-center">
                    <p className={`text-xl font-bold ${getRatingColor(player.rating)}`}>
                      {player.rating}
                    </p>
                    <p className="text-xs text-gray-500">{getRatingBadge(player.rating)}</p>
                  </div>

                  {/* Total Matches */}
                  <div className="col-span-2 text-center">
                    <p className="text-white font-medium">{player.totalMatches}</p>
                    <p className="text-xs text-gray-500">{winRate}% WR</p>
                  </div>

                  {/* W/L/D */}
                  <div className="col-span-3">
                    <div className="flex items-center justify-center space-x-4 text-sm">
                      <span className="text-green-400">{player.wins}W</span>
                      <span className="text-red-400">{player.losses}L</span>
                      <span className="text-yellow-400">{player.draws}D</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {leaderboard.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            No players on the leaderboard yet
          </div>
        )}
      </div>
    </div>
  );
}