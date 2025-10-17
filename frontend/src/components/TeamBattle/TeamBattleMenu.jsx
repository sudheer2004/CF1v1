import React from "react";
import { Users, Plus, Swords, Loader, AlertCircle, X } from "lucide-react";

export default function TeamBattleMenu({
  socketReady,
  error,
  setError,
  setMode,
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <Users className="w-16 h-16 text-purple-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Team Battle</h1>
          <p className="text-gray-400">
            Compete with your friends in epic team coding battles
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-300">{error}</p>
            </div>
            <button
              onClick={() => setError("")}
              className="text-red-400 hover:text-red-300"
            >
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
            onClick={() => setMode("create")}
            disabled={!socketReady}
            className="group bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-700 disabled:to-gray-800 rounded-lg p-8 text-left transition transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
          >
            <Plus className="w-12 h-12 text-white mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">
              Create Room
            </h3>
            <p className="text-purple-100">
              Set up a custom team battle and get a shareable room code
            </p>
          </button>

          <button
            onClick={() => setMode("join")}
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