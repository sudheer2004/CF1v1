import React, { useState, useEffect, useRef } from 'react';
import { Users, Copy, Check, Crown, Swords, ExternalLink, Trophy, Clock, Plus, Loader, AlertCircle, X } from 'lucide-react';
import api from '../services/api.service';
import socketService from '../services/socket.service';

const AVAILABLE_YEARS = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017];
const TEAM_SIZE = 4;

export default function TeamBattle({ user, socket, socketReady }) {
  const [mode, setMode] = useState('menu');
  const [copied, setCopied] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  
  const [battle, setBattle] = useState(null);
  const [stats, setStats] = useState(null);
  const [matchTimer, setMatchTimer] = useState(0);
  const [isCreator, setIsCreator] = useState(false);
  
  const [formData, setFormData] = useState({
    duration: 30,
    numProblems: 4,
    problems: [
      { points: 100, useCustomLink: false, rating: 1200, useRange: false, ratingMin: 800, ratingMax: 1200, minYear: 2020, customLink: '' },
      { points: 100, useCustomLink: false, rating: 1400, useRange: false, ratingMin: 1200, ratingMax: 1600, minYear: 2020, customLink: '' },
      { points: 100, useCustomLink: false, rating: 1600, useRange: false, ratingMin: 1600, ratingMax: 2000, minYear: 2020, customLink: '' },
      { points: 100, useCustomLink: false, rating: 1800, useRange: false, ratingMin: 2000, ratingMax: 2400, minYear: 2020, customLink: '' },
    ]
  });

  const timerRef = useRef(null);

  // Check for active battle on mount
  useEffect(() => {
    checkForActiveBattle();
  }, []);

  // Setup socket event listeners
  useEffect(() => {
    if (!socket || !socketReady) return;

    socket.on('team-battle-created', handleBattleCreated);
    socket.on('team-battle-state', handleBattleState);
    socket.on('team-battle-updated', handleBattleUpdated);
    socket.on('team-battle-preparing', handleBattlePreparing);
    socket.on('team-battle-started', handleBattleStarted);
    socket.on('team-battle-update', handleBattleUpdate);
    socket.on('team-battle-ended', handleBattleEnded);
    socket.on('removed-from-battle', handleRemovedFromBattle);

    return () => {
      socket.off('team-battle-created', handleBattleCreated);
      socket.off('team-battle-state', handleBattleState);
      socket.off('team-battle-updated', handleBattleUpdated);
      socket.off('team-battle-preparing', handleBattlePreparing);
      socket.off('team-battle-started', handleBattleStarted);
      socket.off('team-battle-update', handleBattleUpdate);
      socket.off('team-battle-ended', handleBattleEnded);
      socket.off('removed-from-battle', handleRemovedFromBattle);
    };
  }, [socket, socketReady]);

  // Timer countdown
  useEffect(() => {
    if (!battle || battle.status !== 'active' || !battle.endTime) {
      setMatchTimer(0);
      return;
    }

    const calculateRemaining = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((new Date(battle.endTime).getTime() - now) / 1000));
      return remaining;
    };

    setMatchTimer(calculateRemaining());

    timerRef.current = setInterval(() => {
      const remaining = calculateRemaining();
      setMatchTimer(remaining);
      
      if (remaining === 0) {
        clearInterval(timerRef.current);
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [battle?.endTime, battle?.status]);

  // Initialize stats if missing when in match mode
  useEffect(() => {
    if (mode === 'match' && battle && !stats) {
      setStats({
        teamAScore: 0,
        teamBScore: 0,
        problemsSolved: { teamA: 0, teamB: 0 }
      });
    }
  }, [mode, battle, stats]);

  // === API Calls ===
  const checkForActiveBattle = async () => {
    try {
      const response = await api.call('/team-battle/active');
      if (response.battle) {
        setBattle(response.battle);
        setStats(response.stats);
        setIsCreator(response.battle.creatorId === user.id);
        
        if (response.battle.status === 'waiting') {
          setMode('waiting');
          if (socket && socketReady) {
            socket.emit('join-team-battle-room', { battleCode: response.battle.battleCode });
          }
        } else if (response.battle.status === 'active') {
          setMode('match');
          if (socket && socketReady) {
            socket.emit('join-team-battle-room', { battleCode: response.battle.battleCode });
          }
        }
      }
    } catch (err) {
      console.log('No active battle');
    }
  };

  // === Socket Handlers ===
  const handleBattleCreated = (data) => {
    console.log('✅ Battle created:', data.battle);
    setBattle(data.battle);
    setIsCreator(true);
    setIsCreating(false);
    setMode('waiting');
  };

  const handleBattleState = (data) => {
    console.log('📊 Battle state:', data.battle);
    if (!isLeaving) {
      setBattle(data.battle);
      setIsCreator(data.battle.creatorId === user.id);
    }
  };

  const handleBattleUpdated = (data) => {
    console.log('🔄 Battle updated:', data.battle);
    if (!isLeaving) {
      setBattle(data.battle);
    }
  };

  const handleBattlePreparing = (data) => {
    console.log('⏳ Battle preparing:', data.message);
    setIsPreparing(true);
    setError('');
  };

  const handleBattleStarted = (data) => {
    console.log('🚀 Battle started:', data.battle);
    
    if (!data.battle?.endTime) {
      setError('Invalid battle data received. Please try again.');
      setIsPreparing(false);
      return;
    }
    
    setBattle(data.battle);
    setStats(data.stats || { teamAScore: 0, teamBScore: 0, problemsSolved: { teamA: 0, teamB: 0 } });
    setIsPreparing(false);
    setMode('match');
    setError('');
  };

  const handleBattleUpdate = (data) => {
    console.log('📈 Battle update:', data);
    if (mode === 'match') {
      setBattle(data.battle);
      setStats(data.stats);
    }
  };

  const handleBattleEnded = (data) => {
    console.log('🏁 Battle ended:', data);
    setBattle(data.battle);
    setStats(data.stats);
    setMode('result');
  };

  const handleRemovedFromBattle = (data) => {
    console.log('❌ Removed from battle:', data);
    setError('You have been removed from the battle');
    cleanupBattleState();
  };

  const cleanupBattleState = () => {
    setMode('menu');
    setBattle(null);
    setStats(null);
    setRoomCode('');
    setIsLeaving(false);
  };

  // === Form Handlers ===
  const handleNumProblemsChange = (num) => {
    const newProblems = [...formData.problems];
    while (newProblems.length < num) {
      newProblems.push({ points: 100, useCustomLink: false, rating: 1200, useRange: false, ratingMin: 800, ratingMax: 1600, minYear: 2020, customLink: '' });
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
    if (!socketReady) {
      setError('Not connected to server. Please wait...');
      return;
    }

    if (formData.duration < 1 || formData.duration > 500) {
      setError('Duration must be between 1 and 500 minutes');
      return;
    }

    for (let i = 0; i < formData.problems.length; i++) {
      const prob = formData.problems[i];
      
      if (prob.points < 1 || prob.points > 1000) {
        setError(`Problem ${i + 1}: Points must be between 1 and 1000`);
        return;
      }
      
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
    
    socket.emit('create-team-battle', {
      duration: formData.duration,
      numProblems: formData.numProblems,
      problems: formData.problems
    });
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    if (!socketReady) {
      setError('Not connected to server. Please wait...');
      return;
    }

    setIsJoining(true);
    setError('');
    
    try {
      const response = await api.call(`/team-battle/${roomCode}/join`, {
        method: 'POST'
      });
      
      if (response.success) {
        setBattle(response.battle);
        setIsCreator(false);
        
        socket.emit('join-team-battle-room', { battleCode: roomCode });
        
        setIsJoining(false);
        setMode('waiting');
      }
    } catch (err) {
      setError(err.message || 'Failed to join battle');
      setIsJoining(false);
    }
  };

  const handleCopyRoomId = () => {
    if (battle) {
      navigator.clipboard.writeText(battle.battleCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleMoveToSlot = (teamName, slotIndex) => {
    if (!isCreator || !battle) return;
    
    const currentPlayer = [...battle.players].find(p => p.userId === user.id);
    if (!currentPlayer) return;

    socket.emit('move-team-player', {
      battleId: battle.id,
      userId: user.id,
      newTeam: teamName,
      newPosition: slotIndex
    });
  };

  const handleStartMatch = () => {
    if (!isCreator || !battle) return;
    
    const teamA = battle.players.filter(p => p.team === 'A');
    const teamB = battle.players.filter(p => p.team === 'B');
    
    if (teamA.length === 0 || teamB.length === 0) {
      setError('Both teams must have at least one player');
      return;
    }

    setError('');
    setIsPreparing(true);
    socket.emit('start-team-battle', { battleId: battle.id });
  };

  const handleLeaveBattle = async () => {
    if (!battle || isLeaving) return;

    setIsLeaving(true);
    setError('');

    try {
      if (socket && socketReady) {
        socket.emit('leave-team-battle-room', { 
          battleCode: battle.battleCode,
          battleId: battle.id 
        });
      }

      await api.call(`/team-battle/${battle.id}/leave`, {
        method: 'DELETE'
      });

      cleanupBattleState();
      
      console.log('✅ Successfully left battle');
    } catch (err) {
      console.error('Error leaving battle:', err);
      setError(err.message || 'Failed to leave battle');
      setIsLeaving(false);
    }
  };

  const handleRemovePlayer = (playerId) => {
    if (!isCreator || !battle) return;
    
    socket.emit('remove-team-player', {
      battleId: battle.id,
      targetUserId: playerId
    });
  };

  const handleBackToMenu = async () => {
    if (battle) {
      await handleLeaveBattle();
    } else {
      cleanupBattleState();
      setError('');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTeamPlayers = (team) => {
    if (!battle) return [];
    const teamPlayers = battle.players.filter(p => p.team === team);
    const slots = Array(TEAM_SIZE).fill(null);
    teamPlayers.forEach(player => {
      if (player.position >= 0 && player.position < TEAM_SIZE) {
        slots[player.position] = player;
      }
    });
    return slots;
  };

  const getUserTeam = () => {
    if (!battle || !user) return null;
    const player = battle.players.find(p => p.userId === user.id);
    return player ? player.team : null;
  };

  // === RENDER MODES ===
  
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
              <div className="flex-1">
                <p className="text-red-300">{error}</p>
              </div>
              <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {!socketReady && (
            <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg flex items-center space-x-3">
              <Loader className="w-5 h-5 text-yellow-400 animate-spin" />
              <p className="text-yellow-300">Connecting to server...</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => setMode('create')}
              disabled={!socketReady}
              className="group bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-700 disabled:to-gray-800 rounded-lg p-8 text-left transition transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
            >
              <Plus className="w-12 h-12 text-white mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">Create Room</h3>
              <p className="text-purple-100">
                Set up a custom team battle and get a shareable room code
              </p>
            </button>

            <button
              onClick={() => setMode('join')}
              disabled={!socketReady}
              className="group bg-gradient-to-br from-pink-600 to-red-600 hover:from-pink-700 hover:to-red-700 disabled:from-gray-700 disabled:to-gray-800 rounded-lg p-8 text-left transition transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
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
                  min="1"
                  max="500"
                  disabled={isCreating}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                />
                <p className="text-gray-400 text-sm mt-1">Set duration between 1-500 minutes for team battles</p>
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
                        <div className="flex gap-2 items-center">
                          <label className="text-gray-300 text-sm mr-2">Points:</label>
                          <input
                            type="number"
                            value={problem.points}
                            onChange={(e) => handleProblemChange(index, 'points', parseInt(e.target.value) || 100)}
                            min="1"
                            max="1000"
                            disabled={isCreating}
                            className="w-20 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50"
                          />
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
                disabled={isCreating || !socketReady}
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
                placeholder="ABC12345"
                maxLength={8}
                disabled={isJoining}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-center text-xl font-mono focus:outline-none focus:border-purple-500 disabled:opacity-50"
              />
            </div>

            <button
              onClick={handleJoinRoom}
              disabled={!roomCode.trim() || isJoining || !socketReady}
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

  if (mode === 'waiting' && battle) {
    const teamA = getTeamPlayers('A');
    const teamB = getTeamPlayers('B');

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
        <div className="max-w-7xl mx-auto">
          {isPreparing && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
              <div className="bg-gray-800 rounded-lg p-8 text-center border border-purple-500 max-w-md">
                <div className="mb-6">
                  <div className="relative w-24 h-24 mx-auto">
                    <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full animate-spin" 
                         style={{ borderTopColor: '#a855f7' }}></div>
                    <div className="absolute inset-4 bg-purple-500/20 rounded-full animate-pulse"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Swords className="w-10 h-10 text-purple-400" />
                    </div>
                  </div>
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-2">Starting Battle!</h3>
                <p className="text-gray-300 mb-6">Selecting the perfect problems for your team battle...</p>
                
                <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-400 mb-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                    <span>Finding problems matching your criteria</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-400 mb-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <span>Checking player history</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-400">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    <span>Preparing battle arena</span>
                  </div>
                </div>
                
                <p className="text-sm text-gray-500">This usually takes 2-5 seconds</p>
              </div>
            </div>
          )}

          <div className="flex justify-start mb-4">
            <button
              onClick={handleLeaveBattle}
              disabled={isLeaving}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-all flex items-center space-x-2"
            >
              {isLeaving ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Leaving...</span>
                </>
              ) : (
                <span>← Back</span>
              )}
            </button>
          </div>

          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-600 rounded-full mb-2">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-1">Team Battle Room</h1>
            <p className="text-gray-400 text-sm">Competitive Programming</p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-4 border border-purple-500/20 mb-8">
            <div className="flex items-center justify-center gap-4">
              <div>
                <p className="text-gray-400 text-xs mb-1">Room ID</p>
                <p className="text-xl font-mono font-bold text-purple-400">{battle.battleCode}</p>
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
              <h3 className="text-2xl font-bold text-blue-400">Team A</h3>
              <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-full w-16 h-16 flex items-center justify-center shadow-xl">
                <Swords className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-red-400">Team B</h3>
            </div>

            <div className="flex items-center justify-center gap-4">
              {teamA.map((player, index) => (
                <React.Fragment key={`a-${index}`}>
                  <div
                    className={`w-28 h-28 rounded-xl transition-all ${
                      player
                        ? player.userId === user.id
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600 border-4 border-yellow-400 shadow-lg shadow-blue-500/50'
                          : 'bg-gradient-to-br from-blue-600/60 to-blue-700/60 border-2 border-blue-500/40'
                        : 'bg-gray-700/30 border-2 border-gray-600/50 border-dashed'
                    } flex flex-col items-center justify-center relative`}
                  >
                    {player ? (
                      <>
                        {isCreator && player.userId !== user.id && (
                          <button
                            onClick={() => handleRemovePlayer(player.userId)}
                            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 rounded-full w-6 h-6 flex items-center justify-center text-white text-sm font-bold shadow-lg border-2 border-gray-900 transition-all hover:scale-110"
                          >
                            ×
                          </button>
                        )}
                        <div className="w-14 h-14 bg-blue-400 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg mb-1">
                          {player.username[0]}
                        </div>
                        <span className="text-white font-bold text-xs">{player.username}</span>
                        {player.userId === battle.creatorId && (
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
                    className={`w-28 h-28 rounded-xl transition-all ${
                      player
                        ? player.userId === user.id
                          ? 'bg-gradient-to-br from-red-500 to-red-600 border-4 border-yellow-400 shadow-lg shadow-red-500/50'
                          : 'bg-gradient-to-br from-red-600/60 to-red-700/60 border-2 border-red-500/40'
                        : 'bg-gray-700/30 border-2 border-gray-600/50 border-dashed'
                    } flex flex-col items-center justify-center relative`}
                  >
                    {player ? (
                      <>
                        {isCreator && player.userId !== user.id && (
                          <button
                            onClick={() => handleRemovePlayer(player.userId)}
                            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 rounded-full w-6 h-6 flex items-center justify-center text-white text-sm font-bold shadow-lg border-2 border-gray-900 transition-all hover:scale-110"
                          >
                            ×
                          </button>
                        )}
                        <div className="w-14 h-14 bg-red-400 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg mb-1">
                          {player.username[0]}
                        </div>
                        <span className="text-white font-bold text-xs">{player.username}</span>
                        {player.userId === battle.creatorId && (
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

          {isCreator && (
            <button
              onClick={handleStartMatch}
              disabled={teamA.filter(p => p).length === 0 || teamB.filter(p => p).length === 0}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 rounded-lg transition-all transform hover:scale-105 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-xl"
            >
              <Swords className="w-6 h-6" />
              <span className="text-lg">START MATCH</span>
            </button>
          )}

          {!isCreator && (
            <div className="text-center text-gray-400 py-4">
              <p>Waiting for room creator to start the match...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'match' && battle) {
    const userTeam = getUserTeam();

    if (!stats || !battle.problems || battle.problems.length === 0) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 flex items-center justify-center">
          <div className="bg-gray-800 rounded-lg p-8 text-center border border-purple-500">
            <Loader className="w-16 h-16 text-purple-400 animate-spin mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">Loading Battle...</h3>
            <p className="text-gray-400">Setting up your arena</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <div className={`px-4 py-2 rounded-full font-bold ${
              userTeam === 'A' 
                ? 'bg-blue-600 text-white' 
                : 'bg-red-600 text-white'
            }`}>
              You are on Team {userTeam}
            </div>
            <button
              onClick={handleLeaveBattle}
              disabled={isLeaving}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-all flex items-center space-x-2"
            >
              {isLeaving ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Leaving...</span>
                </>
              ) : (
                <span>Leave Match</span>
              )}
            </button>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-6 border border-purple-500/20 mb-6">
            <div className="grid grid-cols-3 gap-6 items-center">
              <div className={`text-center p-4 rounded-lg ${
                userTeam === 'A' ? 'bg-blue-600/20 border-2 border-blue-500' : ''
              }`}>
                <h3 className="text-blue-400 text-lg font-bold mb-2">
                  Team A {userTeam === 'A' && '(YOU)'}
                </h3>
                <div className="text-5xl font-bold text-white">{stats.teamAScore}</div>
                <p className="text-gray-400 text-sm mt-1">Points</p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <Clock className="w-6 h-6 text-purple-400" />
                  <span className="text-4xl font-mono font-bold text-purple-400">
                    {formatTime(matchTimer)}
                  </span>
                </div>
                <p className="text-gray-400 text-sm">Time Remaining</p>
              </div>

              <div className={`text-center p-4 rounded-lg ${
                userTeam === 'B' ? 'bg-red-600/20 border-2 border-red-500' : ''
              }`}>
                <h3 className="text-red-400 text-lg font-bold mb-2">
                  Team B {userTeam === 'B' && '(YOU)'}
                </h3>
                <div className="text-5xl font-bold text-white">{stats.teamBScore}</div>
                <p className="text-gray-400 text-sm mt-1">Points</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center space-x-2">
              <Trophy className="w-6 h-6 text-yellow-400" />
              <span>Problems</span>
            </h2>

            {battle.problems.map((problem, index) => (
              <div
                key={index}
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
                        {problem.problemName || `Problem ${index + 1}`}
                      </h3>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-bold text-yellow-400">{problem.points} pts</span>
                        {problem.problemRating && (
                          <span className="text-sm text-gray-400">Rating: {problem.problemRating}</span>
                        )}
                        {problem.solvedBy && (
                          <span className={`text-sm font-medium ${
                            problem.solvedBy === 'A' ? 'text-blue-400' : 'text-red-400'
                          }`}>
                            ✓ Solved by Team {problem.solvedBy} - {problem.solvedByUsername}
                            {problem.solvedBy === userTeam && ' (YOUR TEAM)'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {problem.problemUrl && (
                    <a
                      href={problem.problemUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition"
                    >
                      <span>Open Problem</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'result' && battle && stats) {
    const userTeam = getUserTeam();
    const won = stats.teamAScore > stats.teamBScore ? 'A' : stats.teamBScore > stats.teamAScore ? 'B' : null;
    const userWon = won === userTeam;
    const isDraw = won === null;

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 flex items-center justify-center">
        <div className="max-w-2xl w-full">
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-8 border border-purple-500/20 text-center">
            {isDraw ? (
              <>
                <div className="w-24 h-24 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trophy className="w-12 h-12 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-yellow-400 mb-4">It's a Draw!</h1>
                <p className="text-gray-300 text-xl mb-8">Both teams scored {stats.teamAScore} points</p>
              </>
            ) : userWon ? (
              <>
                <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trophy className="w-12 h-12 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-green-400 mb-4">Victory!</h1>
                <p className="text-gray-300 text-xl mb-8">Your team won with {won === 'A' ? stats.teamAScore : stats.teamBScore} points!</p>
              </>
            ) : (
              <>
                <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trophy className="w-12 h-12 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-red-400 mb-4">Defeat</h1>
                <p className="text-gray-300 text-xl mb-8">Your team scored {won === 'A' ? stats.teamBScore : stats.teamAScore} points</p>
              </>
            )}

            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="bg-blue-600/20 border-2 border-blue-500 rounded-lg p-4">
                <h3 className="text-blue-400 font-bold mb-2">Team A</h3>
                <div className="text-3xl font-bold text-white">{stats.teamAScore}</div>
                <p className="text-gray-400 text-sm">points</p>
              </div>
              <div className="bg-red-600/20 border-2 border-red-500 rounded-lg p-4">
                <h3 className="text-red-400 font-bold mb-2">Team B</h3>
                <div className="text-3xl font-bold text-white">{stats.teamBScore}</div>
                <p className="text-gray-400 text-sm">points</p>
              </div>
            </div>

            <button
              onClick={handleBackToMenu}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 rounded-lg transition-all"
            >
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}