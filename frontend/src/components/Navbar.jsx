import React, { useState } from 'react';
import { Menu, X, Trophy, Swords, Users, LogOut, User, Award, Code, Flag } from 'lucide-react';
import { getRatingColor, getRatingBadge } from '../utils/constants';

export default function Navbar({ user, view, setView, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Trophy },
    { id: 'matchmaking', label: 'Matchmaking', icon: Users },
    { id: 'duel', label: 'Duel Mode', icon: Swords },
    { id: 'leaderboard', label: 'Leaderboard', icon: Award },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'report-issues', label: 'Report Issues', icon: Flag },
  ];

  return (
    <nav className="bg-gray-900/50 backdrop-blur-lg border-b border-purple-500/20 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <Code className="w-8 h-8 text-purple-400" />
            <span className="text-xl font-bold text-white hidden sm:block">
              CF Duel
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
                    view === item.id
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* User Info & Logout */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-3 bg-gray-800/50 px-4 py-2 rounded-lg">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{user.username}</p>
                <p className={`text-xs ${getRatingColor(user.rating)}`}>
                  {user.rating} • {getRatingBadge(user.rating)}
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-white"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden py-4 border-t border-gray-700">
            <div className="flex flex-col space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setView(item.id);
                      setMobileOpen(false);
                    }}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                      view === item.id
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700 px-4">
              <p className="text-sm font-medium text-white">{user.username}</p>
              <p className={`text-xs ${getRatingColor(user.rating)} mb-2`}>
                Rating: {user.rating} • {getRatingBadge(user.rating)}
              </p>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}