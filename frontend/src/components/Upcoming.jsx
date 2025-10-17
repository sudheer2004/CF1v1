//team vs team v2
import React, { useState } from 'react';
import { Users, Copy, Check, Crown, Swords, ExternalLink, Trophy, Clock } from 'lucide-react';

const MOCK_ROOM_ID = "ROOM-ABC123";
const MOCK_PROBLEMS = [
  { id: 1, name: "Two Sum", rating: 1200, url: "https://codeforces.com", solvedBy: null },
  { id: 2, name: "Binary Search", rating: 1400, url: "https://codeforces.com", solvedBy: null },
  { id: 3, name: "DP Problem", rating: 1600, url: "https://codeforces.com", solvedBy: "A" },
  { id: 4, name: "Graph Theory", rating: 1800, url: "https://codeforces.com", solvedBy: "B" },
];

export default function TeamVsTeamRoom() {
  const [view, setView] = useState('waiting');
  const [copied, setCopied] = useState(false);
  const [currentUser] = useState({ id: 1, name: "You", isCreator: true, team: 'A' });
  const [matchTime] = useState(1800);
  
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
    setView('match');
  };

  const handleLeaveMatch = () => {
    setView('waiting');
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

  const handleBack = () => {
    // Navigate back to lobby or previous screen
    console.log('Back button clicked');
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTeamScore = (team) => {
    return problems.filter(p => p.solvedBy === team).length;
  };

  if (view === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-start mb-4">
            <button
              onClick={handleBack}
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
            <p className="text-gray-400 text-sm">4 vs 4 Competitive Programming</p>
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
                  {index < 3 && <div className="w-0.5 h-16 bg-blue-500/30"></div>}
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
                  {index < 3 && <div className="w-0.5 h-16 bg-red-500/30"></div>}
                </React.Fragment>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="text-center">
                <div className="bg-blue-600/20 rounded-lg py-2">
                  <span className="text-blue-400 font-bold text-lg">
                    {teamA.filter(p => p !== null).length}/4 Players
                  </span>
                </div>
              </div>
              <div className="text-center">
                <div className="bg-red-600/20 rounded-lg py-2">
                  <span className="text-red-400 font-bold text-lg">
                    {teamB.filter(p => p !== null).length}/4 Players
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
            You're on Team {currentUser.team}
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