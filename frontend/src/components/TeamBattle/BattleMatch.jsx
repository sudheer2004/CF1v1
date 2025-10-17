import React from "react";
import { Clock, Trophy, ExternalLink, Loader, Target, Zap } from "lucide-react";
import { formatTime, getUserTeam } from "../../utils/battleHelpers";

export default function BattleMatch({
  activeBattle,
  battleStats,
  matchTimer,
  user,
  isLeaving,
  onLeave,
}) {
  const userTeam = getUserTeam(activeBattle, user);
  const isFirstSolveMode = activeBattle.winningStrategy === 'first-solve';

  if (!battleStats || !activeBattle.problems || activeBattle.problems.length === 0) {
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
          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-full font-bold ${
              userTeam === 'A' 
                ? 'bg-blue-600 text-white' 
                : 'bg-red-600 text-white'
            }`}>
              You are on Team {userTeam}
            </div>
            {/* Strategy Badge */}
            <div className="px-3 py-1 rounded-full bg-purple-600/30 border border-purple-500/50 flex items-center gap-2">
              {isFirstSolveMode ? (
                <>
                  <Target className="w-4 h-4 text-purple-300" />
                  <span className="text-purple-200 text-sm font-medium">First Solve</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-purple-300" />
                  <span className="text-purple-200 text-sm font-medium">Total Solves</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onLeave}
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
              <div className="text-5xl font-bold text-white">{battleStats.teamAScore}</div>
              <p className="text-gray-400 text-sm mt-1">Points</p>
              {!isFirstSolveMode && (
                <p className="text-blue-400 text-xs mt-2">
                  {battleStats.problemsSolved.teamA} solves
                </p>
              )}
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
              <div className="text-5xl font-bold text-white">{battleStats.teamBScore}</div>
              <p className="text-gray-400 text-sm mt-1">Points</p>
              {!isFirstSolveMode && (
                <p className="text-red-400 text-xs mt-2">
                  {battleStats.problemsSolved.teamB} solves
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center space-x-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <span>Problems</span>
          </h2>

          {activeBattle.problems.map((problem, index) => {
            // Determine styling based on mode
            let cardStyle = 'bg-gray-800/50 border-purple-500/20 hover:border-purple-500/50';
            let problemStatus = null;

            if (isFirstSolveMode) {
              // First-solve mode: Show which team solved it
              if (problem.solvedBy === 'A') {
                cardStyle = 'bg-blue-600/20 border-blue-500/50 opacity-75';
                problemStatus = (
                  <span className="text-blue-400 font-medium">
                    ✓ Solved by Team A - {problem.solvedByUsername}
                    {problem.solvedBy === userTeam && ' (YOUR TEAM)'}
                  </span>
                );
              } else if (problem.solvedBy === 'B') {
                cardStyle = 'bg-red-600/20 border-red-500/50 opacity-75';
                problemStatus = (
                  <span className="text-red-400 font-medium">
                    ✓ Solved by Team B - {problem.solvedByUsername}
                    {problem.solvedBy === userTeam && ' (YOUR TEAM)'}
                  </span>
                );
              }
            } else {
              // Total-solves mode: Problem stays active, show who solved it
              // Note: We don't have per-problem solve tracking in the problem object for total-solves
              // You might want to add this data or fetch it separately
              problemStatus = (
                <span className="text-green-400 font-medium text-sm">
                  🔓 Open for all teams
                </span>
              );
            }

            return (
              <div
                key={index}
                className={`backdrop-blur-lg rounded-lg p-6 border transition-all ${cardStyle}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${
                      isFirstSolveMode && problem.solvedBy === 'A'
                        ? 'bg-blue-600 text-white'
                        : isFirstSolveMode && problem.solvedBy === 'B'
                        ? 'bg-red-600 text-white'
                        : 'bg-purple-600 text-white'
                    }`}>
                      {isFirstSolveMode && problem.solvedBy ? problem.solvedBy : index + 1}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className={`text-xl font-bold mb-1 ${
                        isFirstSolveMode && problem.solvedBy ? 'text-gray-400 line-through' : 'text-white'
                      }`}>
                        {problem.problemName || `Problem ${index + 1}`}
                      </h3>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-bold text-yellow-400">{problem.points} pts</span>
                        {problem.problemRating && (
                          <span className="text-sm text-gray-400">Rating: {problem.problemRating}</span>
                        )}
                        {problemStatus && (
                          <span className="text-sm">{problemStatus}</span>
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
            );
          })}
        </div>

        {/* Info box for total-solves mode */}
        {!isFirstSolveMode && (
          <div className="mt-6 bg-purple-600/20 border border-purple-500/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-purple-400 mt-0.5" />
              <div>
                <h4 className="text-white font-bold mb-1">Total Solves Mode</h4>
                <p className="text-gray-300 text-sm">
                  All team members can solve all problems. Each solve counts towards your team's total score.
                  The team with the most points at the end wins!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}