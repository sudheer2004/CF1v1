import React from "react";
import { Plus, Loader, AlertCircle, Target, Zap } from "lucide-react";
import { AVAILABLE_YEARS } from "../../utils/battleHelpers";

export default function CreateBattleForm({
  formData,
  setFormData,
  error,
  isCreating,
  socketReady,
  onCreate,
  onBack,
}) {
  const handleNumProblemsChange = (num) => {
    const newProblems = [...formData.problems];
    while (newProblems.length < num) {
      newProblems.push({
        points: 100,
        useCustomLink: false,
        rating: 1200,
        useRange: false,
        ratingMin: 800,
        ratingMax: 1200,
        minYear: 2020,
        customLink: "",
      });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-8 border border-purple-500/20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Create Team Battle Room</h2>
            <button
              onClick={onBack}
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
            {/* NEW: Winning Strategy Selection */}
            <div>
              <label className="block text-white font-medium mb-3">
                Winning Strategy
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setFormData({ ...formData, winningStrategy: 'first-solve' })}
                  disabled={isCreating}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.winningStrategy === 'first-solve'
                      ? 'bg-purple-600/30 border-purple-500 shadow-lg shadow-purple-500/20'
                      : 'bg-gray-700/30 border-gray-600 hover:border-purple-500/50'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center justify-center mb-2">
                    <Target className={`w-8 h-8 ${
                      formData.winningStrategy === 'first-solve' ? 'text-purple-400' : 'text-gray-400'
                    }`} />
                  </div>
                  <h3 className={`font-bold mb-1 ${
                    formData.winningStrategy === 'first-solve' ? 'text-white' : 'text-gray-300'
                  }`}>
                    First Solve
                  </h3>
                  <p className="text-xs text-gray-400">
                    First team to solve gets all points. Problem locked after first solve.
                  </p>
                </button>

                <button
                  onClick={() => setFormData({ ...formData, winningStrategy: 'total-solves' })}
                  disabled={isCreating}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.winningStrategy === 'total-solves'
                      ? 'bg-purple-600/30 border-purple-500 shadow-lg shadow-purple-500/20'
                      : 'bg-gray-700/30 border-gray-600 hover:border-purple-500/50'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center justify-center mb-2">
                    <Zap className={`w-8 h-8 ${
                      formData.winningStrategy === 'total-solves' ? 'text-purple-400' : 'text-gray-400'
                    }`} />
                  </div>
                  <h3 className={`font-bold mb-1 ${
                    formData.winningStrategy === 'total-solves' ? 'text-white' : 'text-gray-300'
                  }`}>
                    Total Solves
                  </h3>
                  <p className="text-xs text-gray-400">
                    Both teams can solve all problems. Most total points wins.
                  </p>
                </button>
              </div>
              <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-blue-300 text-sm">
                  {formData.winningStrategy === 'first-solve' 
                    ? '⚡ Fast-paced race! First team to solve each problem claims the points.'
                    : '📊 Codeforces-style! All team members can solve all problems and accumulate points.'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-white font-medium mb-3">
                Match Duration (minutes)
              </label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({ ...formData, duration: val === '' ? '' : parseInt(val) || '' });
                }}
                onBlur={(e) => {
                  if (e.target.value === '' || parseInt(e.target.value) < 1) {
                    setFormData({ ...formData, duration: 1 });
                  }
                }}
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
                          onChange={(e) => {
                            const val = e.target.value;
                            handleProblemChange(index, 'points', val === '' ? '' : parseInt(val) || '');
                          }}
                          onBlur={(e) => {
                            if (e.target.value === '' || parseInt(e.target.value) < 1) {
                              handleProblemChange(index, 'points', 1);
                            }
                          }}
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
                            onChange={(e) => {
                              const val = e.target.value;
                              handleProblemChange(index, problem.useRange ? 'ratingMin' : 'rating', val === '' ? '' : parseInt(val) || '');
                            }}
                            onBlur={(e) => {
                              if (e.target.value === '' || parseInt(e.target.value) < 800) {
                                handleProblemChange(index, problem.useRange ? 'ratingMin' : 'rating', 800);
                              }
                            }}
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
                              onChange={(e) => {
                                const val = e.target.value;
                                handleProblemChange(index, 'ratingMax', val === '' ? '' : parseInt(val) || '');
                              }}
                              onBlur={(e) => {
                                if (e.target.value === '' || parseInt(e.target.value) < 800) {
                                  handleProblemChange(index, 'ratingMax', 800);
                                }
                              }}
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
              onClick={onCreate}
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