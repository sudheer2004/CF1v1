import React from "react";
import { Swords, Loader, AlertCircle } from "lucide-react";

export default function JoinBattleForm({
  roomCode,
  setRoomCode,
  error,
  isJoining,
  socketReady,
  onJoin,
  onBack,
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-lg p-8 border border-purple-500/20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Join Room</h2>
            <button
              onClick={onBack}
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
            onClick={onJoin}
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