import React, { useState } from "react";
import { Trophy, Clock, Zap, Loader, AlertTriangle } from "lucide-react";

function getUserTeam(activeBattle, user) {
  const player = activeBattle.players.find(p => p.userId === user.id);
  return player ? player.team : null;
}

export default function BattleResult({
  activeBattle,
  battleStats,
  user,
  earlyCompletion = false,
  onBackToMenu,
}) {
  const [isLoading, setIsLoading] = useState(false);

  // Extract team elimination data from activeBattle
  const teamEliminated = activeBattle?.teamEliminated || false;
  const eliminatedTeam = activeBattle?.eliminatedTeam || null;
  const reason = activeBattle?.reason || null;

  const userTeam = getUserTeam(activeBattle, user);
  const isFirstSolve = activeBattle.winningStrategy === 'first-solve';
  
  let won = null;
  let tieBreaker = false;
  
  // CRITICAL FIX: Check for team elimination FIRST before checking scores
  if (teamEliminated && eliminatedTeam) {
    // Team was eliminated - the other team wins
    won = eliminatedTeam === 'A' ? 'B' : 'A';
    // console.log('🏆 Winner determined by team elimination:', won);
    // console.log('   Eliminated team:', eliminatedTeam);
    // console.log('   Winning team:', won);
  } else if (battleStats.teamAScore > battleStats.teamBScore) {
    won = 'A';
  } else if (battleStats.teamBScore > battleStats.teamAScore) {
    won = 'B';
  } else if (battleStats.teamAScore === battleStats.teamBScore && battleStats.teamAScore > 0) {
    // Tie in points - check last solve time for total-solves mode
    if (!isFirstSolve && battleStats.lastSolveTime) {
      const teamALastSolve = battleStats.lastSolveTime.teamA;
      const teamBLastSolve = battleStats.lastSolveTime.teamB;
      
      if (teamALastSolve && teamBLastSolve) {
        won = new Date(teamALastSolve) < new Date(teamBLastSolve) ? 'A' : 'B';
        tieBreaker = true;
      } else if (teamALastSolve) {
        won = 'A';
      } else if (teamBLastSolve) {
        won = 'B';
      }
    }
  }
  
  const userWon = won === userTeam;
  const isDraw = won === null;

  // console.log('🎯 Battle Result Display:');
  // console.log('   User team:', userTeam);
  // console.log('   Winning team:', won);
  // console.log('   User won:', userWon);
  // console.log('   Is draw:', isDraw);
  // console.log('   Team eliminated:', teamEliminated);

  const handleBackToMenu = async () => {
    if (isLoading) return; // Prevent double clicks
    
    setIsLoading(true);
    try {
      await onBackToMenu();
    } catch (error) {
      console.error("Error returning to menu:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 flex items-center justify-center">
      <div className="max-w-2xl w-full">
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-8 border border-purple-500/20 text-center">
          {/* Victory/Draw Icon */}
          {isDraw ? (
            <>
              <div className="w-24 h-24 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <Trophy className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-yellow-400 mb-4">It's a Draw!</h1>
              <p className="text-gray-300 text-xl mb-8">
                Both teams scored {battleStats.teamAScore} points
              </p>
            </>
          ) : userWon ? (
            <>
              <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                <Trophy className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-green-400 mb-4">
                {earlyCompletion ? '🎉 Flawless Victory!' : teamEliminated ? '🏆 Victory by Forfeit!' : 'Victory!'}
              </h1>
              <p className="text-gray-300 text-xl mb-4">
                Your team won with {won === 'A' ? battleStats.teamAScore : battleStats.teamBScore} points!
              </p>
              {teamEliminated && eliminatedTeam && (
                <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-300" />
                    <p className="text-yellow-300 text-sm font-bold">
                      Opponent team eliminated - all players left!
                    </p>
                  </div>
                  {reason && (
                    <p className="text-yellow-200 text-xs">{reason}</p>
                  )}
                </div>
              )}
              {earlyCompletion && !teamEliminated && (
                <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3 mb-4">
                  <p className="text-green-300 text-sm font-bold">
                    ⚡ All problems completed before time expired!
                  </p>
                </div>
              )}
              {tieBreaker && (
                <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4 text-blue-300" />
                    <p className="text-blue-300 text-sm font-bold">
                      Won by faster last solve!
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-red-400 mb-4">
                {teamEliminated ? 'Defeat by Forfeit' : 'Defeat'}
              </h1>
              <p className="text-gray-300 text-xl mb-4">
                Your team scored {won === 'A' ? battleStats.teamBScore : battleStats.teamAScore} points
              </p>
              {teamEliminated && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-300" />
                    <p className="text-red-300 text-sm font-bold">
                      Your team was eliminated - all players left!
                    </p>
                  </div>
                  {reason && (
                    <p className="text-red-200 text-xs">{reason}</p>
                  )}
                </div>
              )}
              {earlyCompletion && !teamEliminated && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
                  <p className="text-red-300 text-sm font-bold">
                    Opponent completed all problems first
                  </p>
                </div>
              )}
              {tieBreaker && (
                <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4 text-blue-300" />
                    <p className="text-blue-300 text-sm font-bold">
                      Lost by tie-breaker (slower last solve)
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Score Cards */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className={`border-2 rounded-lg p-4 ${
              won === 'A' 
                ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/20' 
                : 'bg-blue-600/10 border-blue-500/30'
            }`}>
              <h3 className="text-blue-400 font-bold mb-2">Team A</h3>
              <div className="text-3xl font-bold text-white mb-1">{battleStats.teamAScore}</div>
              <p className="text-gray-400 text-sm">points</p>
              {!isFirstSolve && battleStats.problemsSolved && (
                <p className="text-blue-300 text-xs mt-2">
                  {battleStats.problemsSolved.teamA} problems solved
                </p>
              )}
            </div>
            <div className={`border-2 rounded-lg p-4 ${
              won === 'B' 
                ? 'bg-red-600/20 border-red-500 shadow-lg shadow-red-500/20' 
                : 'bg-red-600/10 border-red-500/30'
            }`}>
              <h3 className="text-red-400 font-bold mb-2">Team B</h3>
              <div className="text-3xl font-bold text-white mb-1">{battleStats.teamBScore}</div>
              <p className="text-gray-400 text-sm">points</p>
              {!isFirstSolve && battleStats.problemsSolved && (
                <p className="text-red-300 text-xs mt-2">
                  {battleStats.problemsSolved.teamB} problems solved
                </p>
              )}
            </div>
          </div>

          {/* Strategy Info */}
          <div className="bg-purple-600/10 border border-purple-500/30 rounded-lg p-3 mb-6">
            <div className="flex items-center justify-center gap-2">
              {isFirstSolve ? (
                <>
                  <Zap className="w-4 h-4 text-purple-300" />
                  <span className="text-purple-300 text-sm">First Solve Mode</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-purple-300" />
                  <span className="text-purple-300 text-sm">Total Solves Mode</span>
                </>
              )}
            </div>
          </div>

          {/* Back Button with Loading State */}
          <button
            onClick={handleBackToMenu}
            disabled={isLoading}
            className={`w-full font-bold py-4 rounded-lg transition-all transform ${
              isLoading
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 hover:scale-105'
            } text-white`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader className="w-5 h-5 animate-spin" />
                <span>Returning to Menu...</span>
              </div>
            ) : (
              'Back to Menu'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}