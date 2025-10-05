import React, { useState, useEffect } from 'react';
import { Users, Loader, Clock, X, ExternalLink, AlertCircle } from 'lucide-react';
import { PROBLEM_TAGS, DURATIONS } from '../utils/constants';
import socketService from '../services/socket.service';

export default function Matchmaking({ user, socket }) {
  const [inQueue, setInQueue] = useState(false);
  const [matchFound, setMatchFound] = useState(null);
  const [formData, setFormData] = useState({
    ratingMin: 800,
    ratingMax: 1600,
    tags: [],
    duration: 30,
  });
  const [queueTime, setQueueTime] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!socket) return;

    socketService.on('queue-joined', () => {
      setInQueue(true);
      setError('');
    });

    socketService.on('match-found', (data) => {
      setInQueue(false);
      setMatchFound(data);
    });

    socketService.on('error', (err) => {
      setError(err.message);
      setInQueue(false);
    });

    return () => {
      socketService.off('queue-joined');
      socketService.off('match-found');
      socketService.off('error');
    };
  }, [socket]);

  useEffect(() => {
    let interval;
    if (inQueue) {
      interval = setInterval(() => {
        setQueueTime((t) => t + 1);
      }, 1000);
    } else {
      setQueueTime(0);
    }
    return () => clearInterval(interval);
  }, [inQueue]);

  const handleJoinQueue = () => {
    if (!user.cfHandle) {
      setError('Please add your Codeforces handle in Profile before matchmaking');
      return;
    }

    if (formData.tags.length === 0) {
      setError('Please select at least one problem tag');
      return;
    }

    socketService.joinMatchmaking(formData);
  };

  const handleLeaveQueue = () => {
    socketService.leaveMatchmaking();
    setInQueue(false);
    setQueueTime(0);
  };

  const handleTagToggle = (tag) => {
    setFormData({
      ...formData,
      tags: formData.tags.includes(tag)
        ? formData.tags.filter((t) => t !== tag)
        : [...formData.tags, tag],
    });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (matchFound) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-green-500/10 border-2 border-green-500 rounded-lg p-8 text-center">
          <div className="w-20 h-20 bg-green-500 rounded-full mx-auto mb-6 flex items-center justify-center">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Match Found!</h2>
          <div className="bg-gray-800/50 rounded-lg p-6 mb-6">
            <p className="text-gray-300 mb-2">Opponent</p>
            <p className="text-2xl font-bold text-purple-400">
              {matchFound.opponent.username}
            </p>
            <p className="text-gray-400">Rating: {matchFound.opponent.rating}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-6 mb-6">
            <p className="text-gray-300 mb-2">Problem</p>
            <p className="text-xl font-bold text-white mb-2">
              {matchFound.match.problemName}
            </p>
            <p className="text-gray-400">Rating: {matchFound.match.problemRating}</p>
            <p className="text-sm text-gray-500 mt-2">
              Duration: {matchFound.match.duration} minutes
            </p>
          </div>
          <a
            href={matchFound.problemUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition font-medium"
          >
            <span>Open Problem</span>
            <ExternalLink className="w-5 h-5" />
          </a>
          <p className="text-gray-400 text-sm mt-4">
            The match timer has started. Good luck!
          </p>
        </div>
      </div>
    );
  }

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
            <p className="text-white">Tags: {formData.tags.join(', ')}</p>
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

        {/* Rating Range */}
        <div className="mb-6">
          <label className="block text-white font-medium mb-3">
            Problem Rating Range
          </label>
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
        </div>

        {/* Duration */}
        <div className="mb-6">
          <label className="block text-white font-medium mb-3">Match Duration</label>
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

        {/* Tags */}
        <div className="mb-8">
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
          onClick={handleJoinQueue}
          disabled={!user.cfHandle || formData.tags.length === 0}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition"
        >
          {!user.cfHandle ? 'Add CF Handle First' : 'Join Queue'}
        </button>
      </div>
    </div>
  );
}