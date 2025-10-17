import React from "react";
import { Users, Copy, Check, Crown, Swords, Loader, Target, Zap } from "lucide-react";
import { TEAM_SIZE } from "../../utils/battleHelpers";

export default function BattleWaitingRoom({
  activeBattle,
  user,
  isCreator,
  copied,
  isPreparing,
  isLeaving,
  onCopyRoomId,
  onMoveToSlot,
  onRemovePlayer,
  onStartMatch,
  onLeave,
}) {
  const getTeamPlayers = (team) => {
    if (!activeBattle) return [];
    const teamPlayers = activeBattle.players.filter((p) => p.team === team);
    const slots = Array(TEAM_SIZE).fill(null);
    teamPlayers.forEach((player) => {
      if (player.position >= 0 && player.position < TEAM_SIZE) {
        slots[player.position] = player;
      }
    });
    return slots;
  };

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
            onClick={onLeave}
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

        <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-4 border border-purple-500/20 mb-4">
          <div className="flex items-center justify-center gap-4">
            <div>
              <p className="text-gray-400 text-xs mb-1">Room ID</p>
              <p className="text-xl font-mono font-bold text-purple-400">{activeBattle.battleCode}</p>
            </div>
            <button
              onClick={onCopyRoomId}
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

        {/* NEW: Display Winning Strategy */}
        <div className="bg-gray-700/30 backdrop-blur-lg rounded-lg p-4 border border-purple-500/20 mb-8">
          <div className="flex items-center justify-center gap-3">
            {activeBattle.winningStrategy === 'first-solve' ? (
              <>
                <Target className="w-6 h-6 text-purple-400" />
                <div className="text-center">
                  <span className="text-white font-bold text-lg">First Solve Mode</span>
                  <p className="text-gray-400 text-xs mt-1">First team to solve gets all points</p>
                </div>
              </>
            ) : (
              <>
                <Zap className="w-6 h-6 text-purple-400" />
                <div className="text-center">
                  <span className="text-white font-bold text-lg">Total Solves Mode</span>
                  <p className="text-gray-400 text-xs mt-1">All players can solve all problems - Codeforces style!</p>
                </div>
              </>
            )}
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
                  onClick={() => !player && onMoveToSlot('A', index)}
                  className={`w-28 h-28 rounded-xl transition-all ${
                    player
                      ? player.userId === user.id
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 border-4 border-yellow-400 shadow-lg shadow-blue-500/50'
                        : 'bg-gradient-to-br from-blue-600/60 to-blue-700/60 border-2 border-blue-500/40'
                      : 'bg-gray-700/30 border-2 border-gray-600/50 border-dashed cursor-pointer hover:bg-gray-600/40 hover:border-blue-500/60'
                  } flex flex-col items-center justify-center relative`}
                >
                  {player ? (
                    <>
                      {isCreator && player.userId !== user.id && (
                        <button
                          onClick={() => onRemovePlayer(player.userId)}
                          className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 rounded-full w-6 h-6 flex items-center justify-center text-white text-sm font-bold shadow-lg border-2 border-gray-900 transition-all hover:scale-110"
                        >
                          ×
                        </button>
                      )}
                      <div className="w-14 h-14 bg-blue-400 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg mb-1">
                        {player.username[0]}
                      </div>
                      <span className="text-white font-bold text-xs">{player.username}</span>
                      {player.userId === activeBattle.creatorId && (
                        <Crown className="w-4 h-4 text-yellow-400 absolute top-1 left-1" />
                      )}
                    </>
                  ) : (
                    <>
                      <Users className="w-10 h-10 text-gray-600" />
                      <span className="text-gray-500 text-xs mt-1">Click to join</span>
                    </>
                  )}
                </div>
                {index < TEAM_SIZE - 1 && <div className="w-0.5 h-16 bg-blue-500/30"></div>}
              </React.Fragment>
            ))}

            <div className="w-1 h-24 bg-purple-500/40 mx-2"></div>

            {teamB.map((player, index) => (
              <React.Fragment key={`b-${index}`}>
                <div
                  onClick={() => !player && onMoveToSlot('B', index)}
                  className={`w-28 h-28 rounded-xl transition-all ${
                    player
                      ? player.userId === user.id
                        ? 'bg-gradient-to-br from-red-500 to-red-600 border-4 border-yellow-400 shadow-lg shadow-red-500/50'
                        : 'bg-gradient-to-br from-red-600/60 to-red-700/60 border-2 border-red-500/40'
                      : 'bg-gray-700/30 border-2 border-gray-600/50 border-dashed cursor-pointer hover:bg-gray-600/40 hover:border-red-500/60'
                  } flex flex-col items-center justify-center relative`}
                >
                  {player ? (
                    <>
                      {isCreator && player.userId !== user.id && (
                        <button
                          onClick={() => onRemovePlayer(player.userId)}
                          className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 rounded-full w-6 h-6 flex items-center justify-center text-white text-sm font-bold shadow-lg border-2 border-gray-900 transition-all hover:scale-110"
                        >
                          ×
                        </button>
                      )}
                      <div className="w-14 h-14 bg-red-400 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg mb-1">
                        {player.username[0]}
                      </div>
                      <span className="text-white font-bold text-xs">{player.username}</span>
                      {player.userId === activeBattle.creatorId && (
                        <Crown className="w-4 h-4 text-yellow-400 absolute top-1 left-1" />
                      )}
                    </>
                  ) : (
                    <>
                      <Users className="w-10 h-10 text-gray-600" />
                      <span className="text-gray-500 text-xs mt-1">Click to join</span>
                    </>
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
            onClick={onStartMatch}
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