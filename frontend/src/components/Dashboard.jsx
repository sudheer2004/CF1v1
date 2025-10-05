import React from 'react';
import { Trophy, Target, TrendingUp, Users, Swords, Clock } from 'lucide-react';
import { getRatingColor, getRatingBadge } from '../utils/constants';

export default function Dashboard({ user, setView }) {
  const winRate = user.totalMatches > 0 
    ? ((user.wins / user.totalMatches) * 100).toFixed(1) 
    : 0;

  const stats = [
    { label: 'Total Matches', value: user.totalMatches, icon: Target, color: 'text-blue-400' },
    { label: 'Wins', value: user.wins, icon: Trophy, color: 'text-green-400' },
    { label: 'Losses', value: user.losses, icon: TrendingUp, color: 'text-red-400' },
    { label: 'Draws', value: user.draws, icon: Clock, color: 'text-yellow-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Welcome back, {user.username}!</h1>
        <p className="text-purple-100">Ready to compete and climb the leaderboard?</p>
      </div>

      {/* Rating Card */}
      <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-6 border border-purple-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm mb-1">Current Rating</p>
            <p className={`text-4xl font-bold ${getRatingColor(user.rating)}`}>
              {user.rating}
            </p>
            <p className="text-gray-400 text-sm mt-1">{getRatingBadge(user.rating)}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm mb-1">Win Rate</p>
            <p className="text-3xl font-bold text-green-400">{winRate}%</p>
            <p className="text-gray-400 text-sm mt-1">
              {user.wins}W / {user.losses}L / {user.draws}D
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-6 border border-purple-500/20"
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-6 h-6 ${stat.color}`} />
                <span className={`text-2xl font-bold ${stat.color}`}>
                  {stat.value}
                </span>
              </div>
              <p className="text-gray-400 text-sm">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-6">
        <button
          onClick={() => setView('matchmaking')}
          className="group bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg p-8 text-left transition transform hover:scale-105"
        >
          <Users className="w-12 h-12 text-white mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">Quick Match</h3>
          <p className="text-purple-100">
            Join the matchmaking queue and find an opponent instantly
          </p>
        </button>

        <button
          onClick={() => setView('duel')}
          className="group bg-gradient-to-br from-pink-600 to-red-600 hover:from-pink-700 hover:to-red-700 rounded-lg p-8 text-left transition transform hover:scale-105"
        >
          <Swords className="w-12 h-12 text-white mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">Challenge Friend</h3>
          <p className="text-pink-100">
            Create a custom duel and invite your friends to compete
          </p>
        </button>
      </div>

      {/* CF Handle Warning */}
      {!user.cfHandle && (
        <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-6">
          <h3 className="text-yellow-400 font-semibold mb-2">
            Codeforces Handle Required
          </h3>
          <p className="text-gray-300 mb-4">
            You need to add your Codeforces handle to participate in matches. 
            We use it to track your submissions during duels.
          </p>
          <button
            onClick={() => setView('profile')}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition"
          >
            Add CF Handle
          </button>
        </div>
      )}

      {/* Recent Activity Placeholder */}
      <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-6 border border-purple-500/20">
        <h2 className="text-xl font-bold text-white mb-4">Recent Activity</h2>
        {user.totalMatches === 0 ? (
          <p className="text-gray-400 text-center py-8">
            No matches yet. Start your first duel to see your history here!
          </p>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p>View your complete match history in the Profile section</p>
            <button
              onClick={() => setView('profile')}
              className="mt-4 text-purple-400 hover:text-purple-300 underline"
            >
              Go to Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
}