import { useEffect, useCallback, useRef } from 'react';

export const useTeamBattleSocket = ({
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
}) => {
  const initialModeSet = useRef(false);

  // Ensure socket room is joined when socket becomes ready
  useEffect(() => {
    if (!activeBattle || !socket || !socketReady) return;

    console.log(
      "🔌 Socket ready, ensuring room is joined:",
      activeBattle.battleCode
    );
    socket.emit("join-team-battle-room", {
      battleCode: activeBattle.battleCode,
    });
  }, [socket, socketReady, activeBattle?.battleCode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socket && activeBattle?.battleCode) {
        console.log("🧹 Cleanup: Leaving socket room on unmount");
        socket.emit("leave-team-battle-room", {
          battleCode: activeBattle.battleCode,
          battleId: activeBattle.id,
        });
      }
    };
  }, [activeBattle?.id, socket]);

  // ===== SOCKET HANDLERS =====

  const handleBattleCreated = useCallback(
    (data) => {
      console.log("✅ Battle created:", data.battle);
      setActiveBattle(data.battle);
      setIsCreator(true);
      setMode("waiting");

      if (socket && socketReady) {
        console.log("🔌 Creator joining socket room:", data.battle.battleCode);
        socket.emit("join-team-battle-room", {
          battleCode: data.battle.battleCode,
        });
      }
    },
    [socket, socketReady, setActiveBattle, setIsCreator, setMode]
  );

  const handleBattleState = useCallback(
    (data) => {
      console.log("📊 Battle state received:", data.battle);
      setActiveBattle(data.battle);
      setIsCreator(data.battle.creatorId === user.id);
    },
    [setActiveBattle, setIsCreator, user.id]
  );

  const handleBattleUpdated = useCallback(
    (data) => {
      console.log("🔄 Battle updated received:", data.battle);
      console.log("  - Players count:", data.battle?.players?.length);
      console.log("  - Current activeBattle:", activeBattle ? "exists" : "null");
      console.log("  - isLeaving flag:", isLeaving);

      if (!activeBattle) {
        console.log(
          "⚠️ Ignoring update because activeBattle is null (removed/left)"
        );
        return;
      }

      if (!isLeaving) {
        setActiveBattle(data.battle);
        console.log("✅ Battle state updated in frontend");
      } else {
        console.log("⚠️ Ignoring update because isLeaving=true");
      }
    },
    [activeBattle, isLeaving, setActiveBattle]
  );

  const handleBattlePreparing = useCallback((data) => {
    console.log("⏳ Battle preparing:", data.message);
    setIsPreparing(true);
    setError("");
  }, [setIsPreparing, setError]);

  const handleBattleStarted = useCallback(
    (data) => {
      console.log("🚀 Battle started:", data.battle);

      if (!data.battle?.endTime) {
        setError("Invalid battle data received. Please try again.");
        setIsPreparing(false);
        return;
      }

      setActiveBattle(data.battle);
      setBattleStats(
        data.stats || {
          teamAScore: 0,
          teamBScore: 0,
          problemsSolved: { teamA: 0, teamB: 0 },
        }
      );
      setIsPreparing(false);
      setMode("match");
      setError("");
    },
    [setActiveBattle, setBattleStats, setIsPreparing, setMode, setError]
  );

  const handleBattleUpdate = useCallback(
    (data) => {
      console.log("📈 Battle update received:", data);

      if (!data?.battle || !data?.stats) {
        console.error("❌ Invalid battle update data:", data);
        return;
      }

      console.log(
        "Current scores - TeamA:",
        data.stats.teamAScore,
        "TeamB:",
        data.stats.teamBScore
      );
      
      console.log("Problems data:", data.battle.problems);

      // Force a new object reference to trigger React re-render
      const updatedBattle = {
        ...data.battle,
        problems: [...(data.battle.problems || [])]
      };

      // Always update state
      setActiveBattle(updatedBattle);
      setBattleStats({ ...data.stats });

      // Log new solves
      if (data.newSolves && data.newSolves.length > 0) {
        console.log("🎯 NEW SOLVES DETECTED:");
        data.newSolves.forEach((solve) => {
          console.log(
            `   - Problem ${solve.problemIndex + 1} by ${
              solve.username
            } (Team ${solve.solvedBy}) - ${solve.points}pts`
          );
        });
      }

      console.log("✅ UI state updated successfully");
    },
    [setActiveBattle, setBattleStats]
  );

// In useTeamBattleSocket.js - Updated handleBattleEnded

// In useTeamBattleSocket.js - Updated handleBattleEnded

const handleBattleEnded = useCallback(
  (data) => {
    console.log("🏁 ================================");
    console.log("🏁 BATTLE ENDED EVENT RECEIVED");
    console.log("🏁 ================================");
    console.log("   Full data:", JSON.stringify(data, null, 2));
    console.log("   Current activeBattle:", activeBattle ? "exists" : "null");
    console.log("   Current isLeaving:", isLeaving);
    console.log("   Team Eliminated:", data.teamEliminated);
    console.log("   Eliminated Team:", data.eliminatedTeam);
    console.log("   Winning Team:", data.winningTeam);
    console.log("   Reason:", data.reason);
    console.log("🏁 ================================");
    
    // CRITICAL: Use data.battle from the event, NOT activeBattle
    // This ensures we get the battle data even if activeBattle was cleared
    if (!data.battle) {
      console.error("❌ No battle data in team-battle-ended event!");
      return;
    }

    // Create updated battle object with team elimination data
    const updatedBattle = {
      ...data.battle,
      teamEliminated: data.teamEliminated || false,
      eliminatedTeam: data.eliminatedTeam || null,
      reason: data.reason || null,
      winningTeam: data.winningTeam || null,
    };

    console.log("📦 Setting battle with elimination data:", {
      battleId: updatedBattle.id,
      teamEliminated: updatedBattle.teamEliminated,
      eliminatedTeam: updatedBattle.eliminatedTeam,
      winningTeam: updatedBattle.winningTeam,
      reason: updatedBattle.reason
    });

    // ALWAYS set the battle, even if activeBattle was null
    setActiveBattle(updatedBattle);

    if (data.stats) {
      setBattleStats(data.stats);
    }

    // Track if it was early completion
    if (data.earlyCompletion) {
      console.log("⚡ Early completion detected!");
      setEarlyCompletion(true);
    } else {
      setEarlyCompletion(false);
    }
    
    // Track team elimination
    if (data.teamEliminated) {
      console.log(`⚠️ Team elimination detected!`);
      console.log(`   Eliminated Team: ${data.eliminatedTeam}`);
      console.log(`   Winning Team: ${data.winningTeam}`);
      console.log(`   Reason: ${data.reason}`);
    }
    
    console.log("🎯 Switching to RESULT mode...");
    setMode("result");
    setIsPreparing(false);
    setIsLeaving(false); // CRITICAL: Reset leaving flag so result screen can render
    console.log("✅ Mode switched to result");

    // IMPORTANT: Now leave the socket room after processing the event
    // Use the socket from the hook's context
    if (socket && socketReady && updatedBattle.battleCode) {
      setTimeout(() => {
        console.log("🚪 Now leaving socket room after battle ended");
        socket.emit("leave-team-battle-room", {
          battleCode: updatedBattle.battleCode,
          battleId: updatedBattle.id,
        });
      }, 1000); // Give 1 second for UI to settle
    }
  },
  [socket, socketReady, setActiveBattle, setBattleStats, setMode, setIsPreparing, setEarlyCompletion, setIsLeaving]
  // NOTE: Added socket and socketReady to dependencies
);

  const handleRemovedFromBattle = useCallback(
    (data) => {
      console.log("❌ Removed from battle:", data);

      const battleCode = activeBattle?.battleCode;
      const battleId = activeBattle?.id;

      // Clean state immediately
      cleanupBattleState();

      // THEN leave socket room
      if (socket && battleCode) {
        socket.emit("leave-team-battle-room", {
          battleCode: battleCode,
          battleId: battleId,
        });
      }

      setError("You have been removed from the battle");
      setTimeout(() => setError(""), 3000);
    },
    [activeBattle, socket, cleanupBattleState, setError]
  );

  const handleBattleDeleted = useCallback(
    (data) => {
      console.log("🗑️ Battle deleted:", data);
      setError(data.message || "Battle has been closed");

      if (socket && activeBattle) {
        socket.emit("leave-team-battle-room", {
          battleCode: activeBattle.battleCode,
          battleId: activeBattle.id,
        });
      }

      cleanupBattleState();
      setTimeout(() => setError(""), 3000);
    },
    [activeBattle, socket, cleanupBattleState, setError]
  );

  // Register socket handlers
  useEffect(() => {
    if (!socket || !socketReady) return;

    const handlers = {
      "team-battle-created": handleBattleCreated,
      "team-battle-state": handleBattleState,
      "team-battle-updated": handleBattleUpdated,
      "team-battle-preparing": handleBattlePreparing,
      "team-battle-started": handleBattleStarted,
      "team-battle-update": handleBattleUpdate,
      "team-battle-ended": handleBattleEnded,
      "removed-from-battle": handleRemovedFromBattle,
      "battle-deleted": handleBattleDeleted,
    };

    console.log("📡 Registering socket listeners...");
    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
      console.log(`   ✅ ${event}`);
    });

    return () => {
      console.log("🔌 Unregistering socket listeners...");
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, [
    socket,
    socketReady,
    handleBattleCreated,
    handleBattleState,
    handleBattleUpdated,
    handleBattlePreparing,
    handleBattleStarted,
    handleBattleUpdate,
    handleBattleEnded,
    handleRemovedFromBattle,
    handleBattleDeleted,
  ]);
};