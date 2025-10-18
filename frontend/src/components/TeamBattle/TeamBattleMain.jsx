import React, { useState, useEffect } from "react";
import { Loader } from "lucide-react";
import api from "../../services/api.service";
import { useTeamBattleState } from "../../hooks/useTeamBattleState";
import { useTeamBattleSocket } from "../../hooks/useTeamBattleSocket";
import { useBattleTimer } from "../../hooks/useBattleTimer";
import { validateBattleForm, validateTeamsForStart } from "../../utils/battleHelpers";

import TeamBattleMenu from "./TeamBattleMenu";
import CreateBattleForm from "./CreateBattleForm";
import JoinBattleForm from "./JoinBattleForm";
import BattleWaitingRoom from "./BattleWaitingRoom";
import BattleMatch from "./BattleMatch";
import BattleResult from "./BattleResult";

export default function TeamBattleMain({
  user,
  socket,
  socketReady,
  activeBattle,
  setActiveBattle,
  battleStats,
  setBattleStats,
}) {
  const { mode, setMode, isCreator, setIsCreator, resetState } = useTeamBattleState(activeBattle, user);
  
  const [copied, setCopied] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [earlyCompletion, setEarlyCompletion] = useState(false);

  const matchTimer = useBattleTimer(activeBattle);

  const [formData, setFormData] = useState({
    duration: 30,
    numProblems: 4,
    winningStrategy: 'first-solve',
    problems: [
      {
        points: 100,
        useCustomLink: false,
        rating: 1200,
        useRange: false,
        ratingMin: 800,
        ratingMax: 1200,
        minYear: 2020,
        customLink: "",
      },
      {
        points: 100,
        useCustomLink: false,
        rating: 1400,
        useRange: false,
        ratingMin: 1200,
        ratingMax: 1600,
        minYear: 2020,
        customLink: "",
      },
      {
        points: 100,
        useCustomLink: false,
        rating: 1600,
        useRange: false,
        ratingMin: 1600,
        ratingMax: 2000,
        minYear: 2020,
        customLink: "",
      },
      {
        points: 100,
        useCustomLink: false,
        rating: 1800,
        useRange: false,
        ratingMin: 2000,
        ratingMax: 2400,
        minYear: 2020,
        customLink: "",
      },
    ],
  });

  const cleanupBattleState = () => {
    setMode("menu");
    setActiveBattle(null);
    setBattleStats(null);
    setRoomCode("");
    setIsLeaving(false);
    setEarlyCompletion(false);
    resetState();
  };

  // Initialize stats if missing when in match mode
  useEffect(() => {
    if (mode === "match" && activeBattle && !battleStats) {
      setBattleStats({
        teamAScore: 0,
        teamBScore: 0,
        problemsSolved: { teamA: 0, teamB: 0 },
      });
    }
  }, [mode, activeBattle, battleStats, setBattleStats]);

  // Socket handlers
  useTeamBattleSocket({
    socket,
    socketReady,
    activeBattle,
    setActiveBattle,
    setBattleStats,
    setIsCreator,
    setMode,
    setIsPreparing,
    setError,
    isLeaving,
    setIsLeaving,
    user,
    cleanupBattleState,
    setEarlyCompletion,
  });

  // ===== Handler Functions =====

  const handleCreateRoom = async () => {
    if (!socketReady) {
      setError("Not connected to server. Please wait...");
      return;
    }

    const validationError = validateBattleForm(formData);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsCreating(true);
    setError("");

    socket.emit("create-team-battle", {
      duration: formData.duration,
      numProblems: formData.numProblems,
      problems: formData.problems,
      winningStrategy: formData.winningStrategy,
    });
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) {
      setError("Please enter a room code");
      return;
    }

    if (!socketReady) {
      setError("Not connected to server. Please wait...");
      return;
    }

    setIsJoining(true);
    setError("");

    try {
      // console.log("🔌 Joining battle:", roomCode);
      
      // ✅ Call API first to validate and join
      const response = await api.joinTeamBattle(roomCode);

      if (response.success) {
        // console.log("✅ Joined battle successfully");
        
        // Now join the socket room
        socket.emit("join-team-battle-room", { battleCode: roomCode });
        
        setActiveBattle(response.battle);
        setIsCreator(false);
        setIsJoining(false);
        setMode("waiting");
      }
    } catch (err) {
      console.error("❌ Join room error:", err);
      setError(err.message || "Failed to join battle");
      setIsJoining(false);
    }
  };

  const handleCopyRoomId = () => {
    if (activeBattle) {
      navigator.clipboard.writeText(activeBattle.battleCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleMoveToSlot = (teamName, slotIndex) => {
    if (!activeBattle) return;

    const currentPlayer = activeBattle.players.find(
      (p) => p.userId === user.id
    );
    if (!currentPlayer) return;

    const targetSlot = activeBattle.players.find(
      (p) => p.team === teamName && p.position === slotIndex
    );
    if (targetSlot) {
      // console.log("⚠️ Slot already occupied");
      return;
    }

    // console.log(`🔄 Moving player to Team ${teamName} Position ${slotIndex}`);

    const updatedPlayers = activeBattle.players.map((player) => {
      if (player.userId === user.id) {
        return {
          ...player,
          team: teamName,
          position: slotIndex,
        };
      }
      return player;
    });

    setActiveBattle({
      ...activeBattle,
      players: updatedPlayers,
    });

    // console.log("✅ Local state updated (optimistic)");

    if (socket && socketReady) {
      socket.emit("move-team-player", {
        battleId: activeBattle.id,
        userId: user.id,
        newTeam: teamName,
        newPosition: slotIndex,
      });

      // console.log("📤 Emitted move-team-player to server");
    } else {
      console.error("❌ Socket not ready, cannot emit move");
      setError("Connection lost. Please refresh the page.");
    }
  };

  const handleStartMatch = () => {
    if (!isCreator || !activeBattle) return;

    const validationError = validateTeamsForStart(activeBattle);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setIsPreparing(true);
    socket.emit("start-team-battle", { battleId: activeBattle.id });
  };

  const handleLeaveBattle = async () => {
    // console.log("🚪 handleLeaveBattle called");
    
    if (!activeBattle || isLeaving) {
      // console.log("⚠️ Blocked: No active battle or already leaving");
      return;
    }

    // console.log("🚪 Leaving battle:", activeBattle.battleCode);

    setIsLeaving(true);
    setError("");

    try {
      // Store battle info before API call
      const battleId = activeBattle.id;
      const battleCode = activeBattle.battleCode;
      const battleStatus = activeBattle.status;

      // console.log("📞 Calling leave API for battle:", battleId);
      
      // ONLY call API - do NOT emit socket leave event yet!
      const response = await api.leaveTeamBattle(battleId);

      // console.log("✅ API response received:", JSON.stringify(response, null, 2));
      // console.log("📊 Checking response.teamEliminated:", response.teamEliminated);

      // Check if battle was deleted
      if (response.deleted) {
        // console.log("🗑️ Battle was deleted");
        cleanupBattleState();
        return;
      }

      // CRITICAL: Check for team elimination
      if (response.teamEliminated === true) {
        // console.log("🏆🏆🏆 TEAM ELIMINATION CONFIRMED! 🏆🏆🏆");
        // console.log("   ⏳ Waiting for socket event: team-battle-ended");
        // console.log("   ⚠️ DO NOT cleanup state");
        // console.log("   ⚠️ DO NOT leave socket room");
        // console.log("   ⚠️ Socket handler will switch to result mode");
        
        // Stay in current mode, keep socket connected
        // The team-battle-ended event will arrive soon and switch to result mode
        // isLeaving stays true to show "Leaving..." state
        return;
      }

      // Normal leave - battle continues with other players
      // console.log("✅ Normal leave - cleaning up and leaving socket room");
      
      // Now it's safe to leave the socket room
      if (socket && socketReady) {
        // console.log("🔌 Emitting leave-team-battle-room");
        socket.emit("leave-team-battle-room", {
          battleCode: battleCode,
          battleId: battleId,
        });
      }

      // Cleanup state
      cleanupBattleState();
      // console.log("✅ Successfully left battle");

    } catch (err) {
      console.error("❌ Error leaving battle:", err);
      setError(err.message || "Failed to leave battle");
      setIsLeaving(false);
    }
  };

  const handleRemovePlayer = (playerId) => {
    if (!isCreator || !activeBattle) return;

    // console.log("🚫 Removing player:", playerId);

    socket.emit("remove-team-player", {
      battleId: activeBattle.id,
      targetUserId: playerId,
    });
  };

  const handleBackToMenu = async () => {
    if (activeBattle) {
      await handleLeaveBattle();
    } else {
      cleanupBattleState();
      setError("");
    }
  };

  // ===== RENDER MODES =====
  
  if (mode === "menu") {
    return (
      <TeamBattleMenu
        socketReady={socketReady}
        error={error}
        setError={setError}
        setMode={setMode}
      />
    );
  }

  if (mode === "create") {
    return (
      <CreateBattleForm
        formData={formData}
        setFormData={setFormData}
        error={error}
        isCreating={isCreating}
        socketReady={socketReady}
        onCreate={handleCreateRoom}
        onBack={handleBackToMenu}
      />
    );
  }

  if (mode === "join") {
    return (
      <JoinBattleForm
        roomCode={roomCode}
        setRoomCode={setRoomCode}
        error={error}
        isJoining={isJoining}
        socketReady={socketReady}
        onJoin={handleJoinRoom}
        onBack={handleBackToMenu}
      />
    );
  }

  if (mode === "waiting" && activeBattle) {
    return (
      <BattleWaitingRoom
        activeBattle={activeBattle}
        user={user}
        isCreator={isCreator}
        copied={copied}
        isPreparing={isPreparing}
        isLeaving={isLeaving}
        onCopyRoomId={handleCopyRoomId}
        onMoveToSlot={handleMoveToSlot}
        onRemovePlayer={handleRemovePlayer}
        onStartMatch={handleStartMatch}
        onLeave={handleLeaveBattle}
      />
    );
  }

  if (mode === "match" && activeBattle) {
    return (
      <BattleMatch
        activeBattle={activeBattle}
        battleStats={battleStats}
        matchTimer={matchTimer}
        user={user}
        isLeaving={isLeaving}
        onLeave={handleLeaveBattle}
        socket={socket}
      />
    );
  }

  if (mode === "result" && activeBattle && battleStats) {
    return (
      <BattleResult
        activeBattle={activeBattle}
        battleStats={battleStats}
        user={user}
        earlyCompletion={earlyCompletion}
        onBackToMenu={handleBackToMenu}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center text-white">
          <Loader className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    </div>
  );
}