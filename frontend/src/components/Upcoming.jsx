import React, { useState } from 'react';
import { Users, Copy, Check, Crown, Swords, ExternalLink, Trophy, Clock, Plus, Loader, AlertCircle, X } from 'lucide-react';

const MOCK_ROOM_ID = "ROOM-ABC123";
const MOCK_PROBLEMS = [
  { id: 1, name: "Two Sum", rating: 1200, url: "https://codeforces.com/problemset/problem/1/A", solvedBy: null },
  { id: 2, name: "Binary Search", rating: 1400, url: "https://codeforces.com/problemset/problem/2/A", solvedBy: null },
  { id: 3, name: "DP Problem", rating: 1600, url: "https://codeforces.com/problemset/problem/3/A", solvedBy: "A" },
  { id: 4, name: "Graph Theory", rating: 1800, url: "https://codeforces.com/problemset/problem/4/A", solvedBy: "B" },
];

const AVAILABLE_YEARS = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017];
const TEAM_SIZE = 4;

export default function TeamVsTeamRoom() {
  const [mode, setMode] = useState('menu');
  const [copied, setCopied] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  
  const [currentUser] = useState({ id: 1, name: "You", isCreator: true, team: 'A' });
  const [matchTime] = useState(1800);
  
  const [formData, setFormData] = useState({
    duration: 30,
    numProblems: 4,
    problems: [
      { useCustomLink: false, rating: 1200, useRange: false, ratingMin: 800, ratingMax: 1200, minYear: 2020, customLink: '' },
      { useCustomLink: false, rating: 1400, useRange: false, ratingMin: 1200, ratingMax: 1600, minYear: 2020, customLink: '' },
      { useCustomLink: false, rating: 1600, useRange: false, ratingMin: 1600, ratingMax: 2000, minYear: 2020, customLink: '' },
      { useCustomLink: false, rating: 1800, useRange: false, ratingMin: 2000, ratingMax: 2400, minYear: 2020, customLink: '' },
    ]
  });
  
  const [teamA, setTeamA] = useState([
    { id: 1, name: "You", isCreator: true, team: 'A' },
    { id: 2, name: "Player2", isCreator: false, team: 'A' },
    null,
    null
  ]);
  
  const [teamB, setTeamB] = useState([
    { id: 3, name: "Player3", isCreator: false, team: 'B' },
    null,
    null,
    null
  ]);

  const [problems] = useState(MOCK_PROBLEMS);

  const handleNumProblemsChange = (num) => {
    const newProblems = [...formData.problems];
    while (newProblems.length < num) {
      newProblems.push({ useCustomLink: false, rating: 1200, useRange: false, ratingMin: 800, ratingMax: 1600, minYear: 2020, customLink: '' });
    }
    while (newProblems.length > num) {
      newProblems.pop();
    }
    setFormData({ ...formData, numProblems: num, problems: newProblems });
  };

  const handleProblemChange = (index, field, value) => {
    const newProblems = [...formData.problems];
    newProblems[index] = { ...newProblems[index], [field]: value };
    setFormData({ ...formData, problems: newProblems });
  };

  const handleCreateRoom = () => {
    if (formData.duration < 5 || formData.duration > 180) {
      setError('Duration must be between 5 and 180 minutes');
      return;
    }

    for (let i = 0; i < formData.problems.length; i++) {
      const prob = formData.problems[i];
      
      if (prob.useCustomLink) {
        if (!prob.customLink || !prob.customLink.trim()) {
          setError(`Problem ${i + 1}: Please provide a problem link`);
          return;
        }
      } else {
        if (prob.useRange) {
          if (prob.ratingMin < 800 || prob.ratingMax > 3500) {
            setError(`Problem ${i + 1}: Rating must be between 800 and 3500`);
            return;
          }
          if (prob.ratingMin > prob.ratingMax) {
            setError(`Problem ${i + 1}: Min rating cannot be greater than max rating`);
            return;
          }
        } else {
          if (prob.rating < 800 || prob.rating > 3500) {
            setError(`Problem ${i + 1}: Rating must be between 800 and 3500`);
            return;
          }
        }
      }
    }

    setIsCreating(true);
    setError('');
    
    setTimeout(() => {
      setIsCreating(false);
      setMode('waiting');
      
      const emptySlots = Array(TEAM_SIZE).fill(null);
      setTeamA([{ id: 1, name: "You", isCreator: true, team: 'A' }, ...emptySlots.slice(1)]);
      setTeamB([...emptySlots]);
    }, 1000);
  };

  const handleJoinRoom = () => {
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setIsJoining(true);
    setError('');
    
    setTimeout(() => {
      setIsJoining(false);
      setMode('waiting');
    }, 1000);
  };

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(MOCK_ROOM_ID);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMoveToSlot = (teamName, slotIndex) => {
    if (teamName === 'A') {
      const targetSlot = teamA[slotIndex];
      if (targetSlot !== null) return;
      
      const currentIndexA = teamA.findIndex(p => p?.id === currentUser.id);
      if (currentIndexA !== -1) {
        const newTeamA = [...teamA];
        newTeamA[currentIndexA] = null;
        newTeamA[slotIndex] = currentUser;
        setTeamA(newTeamA);
        return;
      }
      
      const currentIndexB = teamB.findIndex(p => p?.id === currentUser.id);
      if (currentIndexB !== -1) {
        const newTeamB = [...teamB];
        const newTeamA = [...teamA];
        newTeamB[currentIndexB] = null;
        newTeamA[slotIndex] = currentUser;
        setTeamB(newTeamB);
        setTeamA(newTeamA);
      }
    } else {
      const targetSlot = teamB[slotIndex];
      if (targetSlot !== null) return;
      
      const currentIndexB = teamB.findIndex(p => p?.id === currentUser.id);
      if (currentIndexB !== -1) {
        const newTeamB = [...teamB];
        newTeamB[currentIndexB] = null;
        newTeamB[slotIndex] = currentUser;
        setTeamB(newTeamB);
        return;
      }
      
      const currentIndexA = teamA.findIndex(p => p?.id === currentUser.id);
      if (currentIndexA !== -1) {
        const newTeamA = [...teamA];
        const newTeamB = [...teamB];
        newTeamA[currentIndexA] = null;
        newTeamB[slotIndex] = currentUser;
        setTeamA(newTeamA);
        setTeamB(newTeamB);
      }
    }
  };

  const handleStartMatch = () => {
    setMode('match');
  };

  const handleLeaveMatch = () => {
    setMode('waiting');
  };

  const handleRemovePlayer = (teamName, playerId) => {
    if (!currentUser.isCreator) return;
    
    if (teamName === 'A') {
      const newTeamA = teamA.map(p => p?.id === playerId ? null : p);
      setTeamA(newTeamA);
    } else {
      const newTeamB = teamB.map(p => p?.id === playerId ? null : p);
      setTeamB(newTeamB);
    }
  };

  const handleBackToMenu = () => {
    setMode('menu');
    setError('');
    setRoomCode('');
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTeamScore = (team) => {
    return problems.filter(p => p.solvedBy === team).length;
  };

  if (mode === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <Users className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Team Battle</h1>
            <p className="text-gray-400">Compete with your friends in epic team coding battles</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300">{error}</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => setMode('create')}
              className="group bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg p-8 text-left transition transform hover:scale-105"
            >
              <Plus className="w-12 h-12 text-white mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">Create Room</h3>
              <p className="text-purple-100">
                Set up a custom team battle and get a shareable room code
              </p>
            </button>

            <button
              onClick={() => setMode('join')}
              className="group bg-gradient-to-br from-pink-600 to-red-600 hover:from-pink-700 hover:to-red-700 rounded-lg p-8 text-left transition transform hover:scale-105"
            >
              <Swords className="w-12 h-12 text-white mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">Join Room</h3>
              <p className="text-pink-100">
                Enter a room code to join an existing team battle
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-8 border border-purple-500/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Create Team Battle Room</h2>
              <button
                onClick={handleBackToMenu}
                disabled={isCreating}
                className="text-gray-400 hover:text-white disabled:opacity-50"
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
              <div>
                <label className="block text-white font-medium mb-3">
                  Match Duration (minutes)
                </label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 30 })}
                  min="5"
                  max="180"
                  disabled={isCreating}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                />
                <p className="text-gray-400 text-sm mt-1">Recommended: 30-60 minutes</p>
              </div>

              <div>
                <label className="block text-white font-medium mb-3">Number of Problems</label>
                <div className="grid grid-cols-6 gap-3">
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleNumProblemsChange(num)}
                      disabled={isCreating}
                      className={`py-2 px-4 rounded-lg font-medium transition ${
                        formData.numProblems === num
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      } disabled:opacity-50`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-white font-medium mb-3">Problem Configuration</label>
                <div className="space-y-4">
                  {formData.problems.map((problem, index) => (
                    <div key={index} className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-white font-medium">Problem {index + 1}</h4>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleProblemChange(index, 'useCustomLink', false)}
                            disabled={isCreating}
                            className={`px-3 py-1 rounded text-sm font-medium transition ${
                              !problem.useCustomLink
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                            } disabled:opacity-50`}
                          >
                            By Rating
                          </button>
                          <button
                            onClick={() => handleProblemChange(index, 'useCustomLink', true)}
                            disabled={isCreating}
                            className={`px-3 py-1 rounded text-sm font-medium transition ${
                              problem.useCustomLink
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                            } disabled:opacity-50`}
                          >
                            Custom Link
                          </button>
                        </div>
                      </div>
                      
                      {problem.useCustomLink ? (
                        <div>
                          <label className="block text-gray-300 text-sm mb-2">Problem URL</label>
                          <input
                            type="url"
                            value={problem.customLink}
                            onChange={(e) => handleProblemChange(index, 'customLink', e.target.value)}
                            placeholder="https://codeforces.com/problemset/problem/..."
                            disabled={isCreating}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center space-x-3">
                          <div className="flex-1">
                            <label className="block text-gray-300 text-sm mb-2">
                              {problem.useRange ? 'Min Rating' : 'Rating'}
                            </label>
                            <input
                              type="number"
                              value={problem.useRange ? problem.ratingMin : problem.rating}
                              onChange={(e) => handleProblemChange(index, problem.useRange ? 'ratingMin' : 'rating', parseInt(e.target.value) || 800)}
                              min="800"
                              max="3500"
                              step="100"
                              disabled={isCreating}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50"
                            />
                          </div>
                          
                          <button
                            onClick={() => {
                              const newProblems = [...formData.problems];
                              if (!problem.useRange) {
                                newProblems[index] = {
                                  ...problem,
                                  useRange: true,
                                  ratingMin: problem.rating,
                                  ratingMax: problem.rating + 200
                                };
                              } else {
                                newProblems[index] = {
                                  ...problem,
                                  useRange: false,
                                  rating: problem.ratingMin
                                };
                              }
                              setFormData({ ...formData, problems: newProblems });
                            }}
                            disabled={isCreating}
                            className="mt-6 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white p-2 rounded-lg transition"
                          >
                            {problem.useRange ? '⇄' : '→'}
                          </button>

                          {problem.useRange && (
                            <div className="flex-1">
                              <label className="block text-gray-300 text-sm mb-2">Max Rating</label>
                              <input
                                type="number"
                                value={problem.ratingMax}
                                onChange={(e) => handleProblemChange(index, 'ratingMax', parseInt(e.target.value) || 1600)}
                                min="800"
                                max="3500"
                                step="100"
                                disabled={isCreating}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50"
                              />
                            </div>
                          )}

                          <div className="flex-1">
                            <label className="block text-gray-300 text-sm mb-2">From Year</label>
                            <select
                              value={problem.minYear}
                              onChange={(e) => handleProblemChange(index, 'minYear', parseInt(e.target.value))}
                              disabled={isCreating}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50"
                            >
                              {AVAILABLE_YEARS.map((year) => (
                                <option key={year} value={year}>≥ {year}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreateRoom}
                disabled={isCreating}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 rounded-lg transition-all flex items-center justify-center space-x-2 disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>Creating Room...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    <span>Create Room</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'join') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-8 border border-purple-500/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Join Room</h2>
              <button
                onClick={handleBackToMenu}
                disabled={isJoining}
                className="text-gray-400 hover:text-white disabled:opacity-50"
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
              <label className="block text-white font-medium mb-3">Enter Room Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g., ROOM-ABC123"
                maxLength={12}
                disabled={isJoining}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-center text-xl font-mono focus:outline-none focus:border-purple-500 disabled:opacity-50"
              />
            </div>

            <button
              onClick={handleJoinRoom}
              disabled={!roomCode.trim() || isJoining}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 rounded-lg transition-all flex items-center justify-center space-x-2 disabled:cursor-not-allowed"
            >
              {isJoining ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>Joining Room...</span>
                </>
              ) : (
                <>
                  <Swords className="w-5 h-5" />
                  <span>Join Room</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-start mb-4">
            <button
              onClick={handleBackToMenu}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-all flex items-center space-x-2"
            >
              <span>← Back</span>
            </button>
          </div>

          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-600 rounded-full mb-2">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-1">Team Battle Room</h1>
            <p className="text-gray-400 text-sm">4v4 Competitive Programming</p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-4 border border-purple-500/20 mb-8">
            <div className="flex items-center justify-center gap-4">
              <div>
                <p className="text-gray-400 text-xs mb-1">Room ID</p>
                <p className="text-xl font-mono font-bold text-purple-400">{MOCK_ROOM_ID}</p>
              </div>
              <button
                onClick={handleCopyRoomId}
                className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-lg transition"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span className="text-white text-sm">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-white" />
                    <span className="text-white text-sm">Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-gray-800/30 backdrop-blur-lg rounded-lg p-6 border border-purple-500/20 mb-8">
            <div className="flex items-center justify-center gap-8 mb-8">
              <h3 className="text-2xl font-bold text-blue-400">Team 1</h3>
              <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-full w-16 h-16 flex items-center justify-center shadow-xl">
                <Swords className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-red-400">Team 2</h3>
            </div>

            <div className="flex items-center justify-center gap-4">
              {teamA.map((player, index) => (
                <React.Fragment key={`a-${index}`}>
                  <div
                    onClick={() => !player && handleMoveToSlot('A', index)}
                    className={`w-28 h-28 rounded-xl transition-all ${
                      player
                        ? player.id === currentUser.id
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600 border-4 border-yellow-400 shadow-lg shadow-blue-500/50'
                          : 'bg-gradient-to-br from-blue-600/60 to-blue-700/60 border-2 border-blue-500/40'
                        : 'bg-gray-700/30 border-2 border-gray-600/50 border-dashed cursor-pointer hover:border-purple-500/80 hover:bg-gray-600/40'
                    } flex flex-col items-center justify-center relative`}
                  >
                    {player ? (
                      <>
                        {currentUser.isCreator && player.id !== currentUser.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePlayer('A', player.id);
                            }}
                            className="absolute -top-2 -right-2 bg-blue-500 hover:bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-white text-sm font-bold shadow-lg border-2 border-gray-900 transition-all hover:scale-110"
                          >
                            ×
                          </button>
                        )}
                        <div className="w-14 h-14 bg-blue-400 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg mb-1">
                          {player.name[0]}
                        </div>
                        <span className="text-white font-bold text-xs">{player.name}</span>
                        {player.isCreator && (
                          <Crown className="w-4 h-4 text-yellow-400 absolute top-1 left-1" />
                        )}
                      </>
                    ) : (
                      <Users className="w-10 h-10 text-gray-600" />
                    )}
                  </div>
                  {index < TEAM_SIZE - 1 && <div className="w-0.5 h-16 bg-blue-500/30"></div>}
                </React.Fragment>
              ))}

              <div className="w-1 h-24 bg-purple-500/40 mx-2"></div>

              {teamB.map((player, index) => (
                <React.Fragment key={`b-${index}`}>
                  <div
                    onClick={() => !player && handleMoveToSlot('B', index)}
                    className={`w-28 h-28 rounded-xl transition-all ${
                      player
                        ? player.id === currentUser.id
                          ? 'bg-gradient-to-br from-red-500 to-red-600 border-4 border-yellow-400 shadow-lg shadow-red-500/50'
                          : 'bg-gradient-to-br from-red-600/60 to-red-700/60 border-2 border-red-500/40'
                        : 'bg-gray-700/30 border-2 border-gray-600/50 border-dashed cursor-pointer hover:border-purple-500/80 hover:bg-gray-600/40'
                    } flex flex-col items-center justify-center relative`}
                  >
                    {player ? (
                      <>
                        {currentUser.isCreator && player.id !== currentUser.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePlayer('B', player.id);
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 rounded-full w-6 h-6 flex items-center justify-center text-white text-sm font-bold shadow-lg border-2 border-gray-900 transition-all hover:scale-110"
                          >
                            ×
                          </button>
                        )}
                        <div className="w-14 h-14 bg-red-400 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg mb-1">
                          {player.name[0]}
                        </div>
                        <span className="text-white font-bold text-xs">{player.name}</span>
                        {player.isCreator && (
                          <Crown className="w-4 h-4 text-yellow-400 absolute top-1 left-1" />
                        )}
                      </>
                    ) : (
                      <Users className="w-10 h-10 text-gray-600" />
                    )}
                  </div>
                  {index < TEAM_SIZE - 1 && <div className="w-0.5 h-16 bg-red-500/30"></div>}
                </React.Fragment>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="text-center">
                <div className="bg-blue-600/20 rounded-lg py-2">
                  <span className="text-blue-400 font-bold text-lg">
                    {teamA.filter(p => p !== null).length}/{TEAM_SIZE} Players
                  </span>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-red-600/20 rounded-lg py-2">
                  <span className="text-red-400 font-bold text-lg">
                    {teamB.filter(p => p !== null).length}/{TEAM_SIZE} Players
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6">
            <p className="text-yellow-300 text-sm text-center">
              💡 Click on any empty slot to move yourself. Your position has a golden border.
            </p>
          </div>

          {currentUser.isCreator && (
            <button
              onClick={handleStartMatch}
              disabled={teamA.filter(p => p).length === 0 || teamB.filter(p => p).length === 0}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 rounded-lg transition-all transform hover:scale-105 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-xl"
            >
              <Swords className="w-6 h-6" />
              <span className="text-lg">START MATCH</span>
            </button>
          )}

          {!currentUser.isCreator && (
            <div className="text-center text-gray-400 py-4">
              <p>Waiting for room creator to start the match...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <div className={`px-4 py-2 rounded-full font-bold ${
            currentUser.team === 'A' 
              ? 'bg-blue-600 text-white' 
              : 'bg-red-600 text-white'
          }`}>
            You are on Team {currentUser.team}
          </div>
          <button
            onClick={handleLeaveMatch}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-all flex items-center space-x-2"
          >
            <span>Leave Match</span>
          </button>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-6 border border-purple-500/20 mb-6">
          <div className="grid grid-cols-3 gap-6 items-center">
            <div className={`text-center p-4 rounded-lg ${
              currentUser.team === 'A' ? 'bg-blue-600/20 border-2 border-blue-500' : ''
            }`}>
              <h3 className="text-blue-400 text-lg font-bold mb-2">
                Team A {currentUser.team === 'A' && '(YOU)'}
              </h3>
              <div className="text-5xl font-bold text-white">{getTeamScore('A')}</div>
              <p className="text-gray-400 text-sm mt-1">Problems Solved</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Clock className="w-6 h-6 text-purple-400" />
                <span className="text-4xl font-mono font-bold text-purple-400">
                  {formatTime(matchTime)}
                </span>
              </div>
              <p className="text-gray-400 text-sm">Time Remaining</p>
            </div>

            <div className={`text-center p-4 rounded-lg ${
              currentUser.team === 'B' ? 'bg-red-600/20 border-2 border-red-500' : ''
            }`}>
              <h3 className="text-red-400 text-lg font-bold mb-2">
                Team B {currentUser.team === 'B' && '(YOU)'}
              </h3>
              <div className="text-5xl font-bold text-white">{getTeamScore('B')}</div>
              <p className="text-gray-400 text-sm mt-1">Problems Solved</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center space-x-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <span>Problems</span>
          </h2>

          {problems.map((problem, index) => (
            <div
              key={problem.id}
              className={`backdrop-blur-lg rounded-lg p-6 border transition-all ${
                problem.solvedBy === 'A'
                  ? 'bg-blue-600/20 border-blue-500/50 opacity-75'
                  : problem.solvedBy === 'B'
                  ? 'bg-red-600/20 border-red-500/50 opacity-75'
                  : 'bg-gray-800/50 border-purple-500/20 hover:border-purple-500/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 flex-1">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${
                    problem.solvedBy === 'A'
                      ? 'bg-blue-600 text-white'
                      : problem.solvedBy === 'B'
                      ? 'bg-red-600 text-white'
                      : 'bg-purple-600 text-white'
                  }`}>
                    {problem.solvedBy || index + 1}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className={`text-xl font-bold mb-1 ${problem.solvedBy ? 'text-gray-400 line-through' : 'text-white'}`}>
                      {problem.name}
                    </h3>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-400">Rating: {problem.rating}</span>
                      {problem.solvedBy && (
                        <span className={`text-sm font-medium ${
                          problem.solvedBy === 'A' ? 'text-blue-400' : 'text-red-400'
                        }`}>
                          ✓ Solved by Team {problem.solvedBy}
                          {problem.solvedBy === currentUser.team && ' (YOUR TEAM)'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <a
                  href={problem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition"
                >
                  <span>Open Problem</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}