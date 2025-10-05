import React, { useState, useEffect } from 'react';
import { Plus, Copy, Check, Swords, ExternalLink, AlertCircle } from 'lucide-react';
import { PROBLEM_TAGS, DURATIONS } from '../utils/constants';
import socketService from '../services/socket.service';

export default function DuelMode({ user, socket }) {
  const [mode, setMode] = useState('menu'); // menu, create, join, waiting, active
  const [duel, setDuel] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    ratingMin: 800,
    ratingMax: 1600,
    tags: [],
    duration: 30,
  });

  useEffect(() => {
    if (!socket) return;

    socketService.on('duel-created', (data) => {
      setDuel(data.duel);
      setMode('waiting');
      setError('');
    });

    socketService.on('opponent-joined', (data) => {
      setDuel(data.duel);
    });

    socketService.on('match-start', (data) => {
      setMatchData(data);
      setMode('active');
    });

    socketService.on('error', (err) => {
      setError(err.message);
    });

    return () => {
      socketService.off('duel-created');
      socketService.off('opponent-joined');
      socketService.off('match-start');
      socketService.off('error');
    };
  }, [socket]);

  const handleCreateDuel = () => {
    if (!user.cfHandle) {
      setError('Please add your Codeforces handle in Profile first');
      return;
    }
    if (formData.tags.length === 0) {
      setError('Please select at least one problem tag');
      return;
    }
    socketService.createDuel(formData);
  };

  const handleJoinDuel = () => {
    if (!user.cfHandle) {
      setError('Please add your Codeforces handle in Profile first');
      return;
    }
    if (!joinCode.trim()) {
      setError('Please enter a duel code');
      return;
    }
    socketService.joinDuel(joinCode.toUpperCase());
  };

  const copyDuelCode = () => {
    navigator.clipboard.writeText(duel.duelCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTagToggle = (tag) => {
    setFormData({
      ...formData,
      tags: formData.tags.includes(tag)
        ? formData.tags.filter((t) => t !== tag)
        : [...formData.tags, tag],
    });
  };

  // Active Match View
  if (mode === 'active' && matchData) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-green-500/10 border-2 border-green-500 rounded-lg p-8">
          <h2 className="text-3xl font-bold text-white mb-6 text-center">
            Duel Started!
          </h2>
          <div className="bg-gray-800/50 rounded-lg p-6 mb-6">
            <p className="text-gray-300 mb-2">Problem</p>
            <p className="text-2xl font-bold text-white mb-2">
              {matchData.match.problemName}
            </p>
            <p className="text-gray-400">Rating: {matchData.match.problemRating}</p>
            <p className="text-sm text-gray-500 mt-2">
              Duration: {matchData.match.duration} minutes
            </p>
          </div>
          <a
            href={matchData.problemUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition font-medium"
          >
            <span>Open Problem on Codeforces</span>
            <ExternalLink className="w-5 h-5" />
          </a>
          <p className="text-gray-400 text-sm mt-4 text-center">
            Solve the problem and submit on Codeforces. We'll track your progress!
          </p>
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