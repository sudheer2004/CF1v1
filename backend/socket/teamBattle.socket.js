const teamBattleService = require('../services/teamBattle.service');
const teamBattlePollingService = require('../services/teamBattlePolling.service');
const codeforcesService = require('../services/codeforces.service');
const prisma = require('../config/database.config');
const battleMemory = require('./teamBattleMemory'); // ✅ FIXED: Correct filename

// Store active polling intervals: battleId -> intervalId
const activePolls = new Map();

/**
 * Initialize team battle socket handlers
 */
const initializeTeamBattleSocket = (io, socket) => {
  
  /**
   * Create team battle room
   */
  socket.on('create-team-battle', async (data) => {
    try {
      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const { duration, numProblems, problems } = data;

      // Validation
      if (!duration || !numProblems || !problems) {
        socket.emit('error', { message: 'Missing required fields' });
        return;
      }

      // Fetch user data from database
      const user = await prisma.user.findUnique({
        where: { id: socket.userId },
        select: {
          id: true,
          username: true,
          cfHandle: true,
          rating: true,
        },
      });

      if (!user) {
        socket.emit('error', { message: 'User not found' });
        return;
      }

      const battle = await teamBattleService.createBattle(
        socket.userId,
        {
          username: user.username,
          cfHandle: user.cfHandle || user.username,
          rating: user.rating || 0,
        },
        {
          duration,
          numProblems,
          problems,
        }
      );

      // Add to memory store
      battleMemory.addBattle(battle);

      // Join socket room
      socket.join(`team-battle-${battle.battleCode}`);
      socket.join(`team-battle-${battle.id}`);

      console.log(`✅ Team battle created: ${battle.battleCode} by ${user.username}`);

      socket.emit('team-battle-created', { battle });
    } catch (error) {
      console.error('Create team battle error:', error);
      socket.emit('error', { message: error.message || 'Failed to create team battle' });
    }
  });

  /**
   * Join team battle room - FIXED FOR INSTANT UPDATES
   */
  socket.on('join-team-battle-room', async (data) => {
    try {
      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const { battleCode } = data;

      console.log(`🔍 Join room request - User: ${socket.userId}, Room: ${battleCode}`);

      // Try memory first, fallback to database
      let battle = battleMemory.getBattleByCode(battleCode);
      
      if (!battle) {
        console.log(`📥 Battle not in memory, fetching from database...`);
        battle = await teamBattleService.getBattleByCode(battleCode);
        
        if (!battle) {
          console.log(`❌ Battle not found: ${battleCode}`);
          socket.emit('error', { message: 'Battle not found' });
          return;
        }

        // Add to memory for future fast access
        battleMemory.addBattle(battle);
      }

      console.log(`✅ Battle found: ${battle.id}, Players: ${battle.players.length}`);

      // Join socket rooms
      socket.join(`team-battle-${battleCode}`);
      socket.join(`team-battle-${battle.id}`);

      console.log(`✅ User ${socket.userId} joined team battle room: ${battleCode}`);

      // ✅ Send current state to THIS socket
      socket.emit('team-battle-state', { battle });
      
      // ✅ Broadcast to ALL users in the room (so everyone sees the update)
      io.to(`team-battle-${battleCode}`).emit('team-battle-updated', { battle });
      
      console.log(`📢 Broadcasted updated battle state to room ${battleCode}`);
    } catch (error) {
      console.error('Join team battle room error:', error);
      socket.emit('error', { message: error.message });
    }
  });

  /**
   * Leave team battle room
   */
  socket.on('leave-team-battle-room', async (data) => {
    try {
      if (!socket.userId) {
        return;
      }

      const { battleCode, battleId } = data;

      if (!battleCode && !battleId) {
        console.warn('Leave team battle room: Missing battleCode and battleId');
        return;
      }

      // Leave socket rooms
      if (battleCode) {
        socket.leave(`team-battle-${battleCode}`);
        console.log(`✅ User ${socket.userId} left team battle room: ${battleCode}`);
      }
      
      if (battleId) {
        socket.leave(`team-battle-${battleId}`);
        console.log(`✅ User ${socket.userId} left team battle room ID: ${battleId}`);
      }
    } catch (error) {
      console.error('Leave team battle room error:', error);
    }
  });

  /**
   * Move player to different slot - OPTIMIZED FOR INSTANT UPDATES
   */
  socket.on('move-team-player', async (data) => {
    try {
      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const { battleId, userId, newTeam, newPosition } = data;

      console.log(`🔄 Move request: User ${userId} to Team ${newTeam} Position ${newPosition}`);

      // Get battle from memory first
      let battle = battleMemory.getBattleById(battleId);
      
      if (!battle) {
        battle = await teamBattleService.getBattleWithDetails(battleId);
        if (battle) {
          battleMemory.addBattle(battle);
        }
      }

      if (!battle) {
        socket.emit('error', { message: 'Battle not found' });
        return;
      }

      // Verify authorization
      const isCreator = battle.creatorId === socket.userId;
      const isMovingSelf = userId === socket.userId;

      if (!isCreator && !isMovingSelf) {
        socket.emit('error', { message: 'Not authorized to move this player' });
        return;
      }

      // Update in memory FIRST (instant)
      try {
        const updatedBattle = battleMemory.movePlayer(battleId, userId, newTeam, newPosition);

        // 🚀 INSTANT BROADCAST to all players
        io.to(`team-battle-${battle.battleCode}`).emit('team-battle-updated', { 
          battle: updatedBattle 
        });

        console.log(`📢 Instant broadcast sent to room ${battle.battleCode}`);

        // THEN update database asynchronously
        teamBattleService.movePlayer(battleId, userId, newTeam, newPosition)
          .catch(err => {
            console.error('❌ Database update failed:', err);
            // If database fails, refresh from database
            teamBattleService.getBattleWithDetails(battleId)
              .then(correctBattle => {
                if (correctBattle) {
                  battleMemory.addBattle(correctBattle);
                  io.to(`team-battle-${battle.battleCode}`).emit('team-battle-updated', { 
                    battle: correctBattle 
                  });
                }
              });
          });

      } catch (memoryError) {
        console.error('❌ Memory update failed:', memoryError);
        socket.emit('error', { message: memoryError.message });
        
        // Refresh from database
        const freshBattle = await teamBattleService.getBattleWithDetails(battleId);
        if (freshBattle) {
          battleMemory.addBattle(freshBattle);
          io.to(`team-battle-${battle.battleCode}`).emit('team-battle-updated', { 
            battle: freshBattle 
          });
        }
      }

    } catch (error) {
      console.error('Move team player error:', error);
      socket.emit('error', { message: error.message });
    }
  });

  /**
   * Remove player from battle - FIXED
   */
  socket.on('remove-team-player', async (data) => {
  try {
    if (!socket.userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const { battleId, targetUserId } = data;

    console.log('🚫 Remove player request:', { battleId, targetUserId, requestedBy: socket.userId });

    // Get battle from memory first
    let battle = battleMemory.getBattleById(battleId);
    if (!battle) {
      battle = await teamBattleService.getBattleWithDetails(battleId);
      if (battle) {
        battleMemory.addBattle(battle);
      }
    }

    if (!battle) {
      socket.emit('error', { message: 'Battle not found' });
      return;
    }

    if (battle.creatorId !== socket.userId) {
      socket.emit('error', { message: 'Only creator can remove players' });
      return;
    }

    console.log('✅ User authorized to remove player');

    // Find all sockets in the room
    const allSockets = await io.in(`team-battle-${battle.battleCode}`).fetchSockets();
    console.log(`🔍 Found ${allSockets.length} sockets in room`);

    // Notify the removed player first and remove from rooms
    for (const clientSocket of allSockets) {
      if (clientSocket.userId === targetUserId) {
        console.log(`✅ Found removed player's socket, notifying them`);

        clientSocket.emit('removed-from-battle', {
          battleId,
          battleCode: battle.battleCode,
          message: 'You have been removed from the battle',
        });

        clientSocket.leave(`team-battle-${battle.battleCode}`);
        clientSocket.leave(`team-battle-${battle.id}`);

        console.log(`🚪 Removed user ${targetUserId} from battle rooms`);
        break;
      }
    }

    // Update memory AFTER removed player is notified
    const updatedBattle = battleMemory.removePlayer(battleId, targetUserId);

    console.log('📢 Broadcasting updated battle to remaining players');
    io.to(`team-battle-${battle.battleCode}`).emit('team-battle-updated', { 
      battle: updatedBattle 
    });

    // Update database asynchronously
    teamBattleService.removePlayer(battleId, socket.userId, targetUserId)
      .catch(err => console.error('❌ Database remove failed:', err));

  } catch (error) {
    console.error('Remove team player error:', error);
    socket.emit('error', { message: error.message });
  }
});

  /**
   * Start team battle
   */
  socket.on('start-team-battle', async (data) => {
    try {
      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const { battleId } = data;

      let battle = battleMemory.getBattleById(battleId);
      
      if (!battle) {
        battle = await prisma.teamBattle.findUnique({
          where: { id: battleId },
          include: {
            players: true,
            problems: true,
          },
        });
        
        if (battle) {
          battleMemory.addBattle(battle);
        }
      }

      if (!battle) {
        socket.emit('error', { message: 'Battle not found' });
        return;
      }

      if (battle.creatorId !== socket.userId) {
        socket.emit('error', { message: 'Only creator can start battle' });
        return;
      }

      // Emit "preparing" state to all players
      io.to(`team-battle-${battle.battleCode}`).emit('team-battle-preparing', {
        message: 'Selecting problems from Codeforces...',
      });

      // Select problems from Codeforces
      const selectedProblems = await selectProblemsForBattle(battle);

      // Update problems in database
      for (const problem of selectedProblems) {
        await prisma.teamBattleProblem.update({
          where: {
            battleId_problemIndex: {
              battleId: battle.id,
              problemIndex: problem.problemIndex,
            },
          },
          data: {
            contestId: problem.contestId,
            problemIndexChar: problem.index,
            problemName: problem.name,
            problemRating: problem.rating,
            problemUrl: problem.contestId 
              ? `https://codeforces.com/contest/${problem.contestId}/problem/${problem.index}`
              : null,
          },
        });
      }

      // Start the battle
      const { startTime, endTime } = await teamBattleService.startBattle(
        battleId,
        socket.userId
      );

      // Fetch updated battle with problems
      const startedBattle = await teamBattleService.getBattleWithDetails(battleId);

      // Update memory
      battleMemory.updateBattleStatus(battleId, 'active', { startTime, endTime });
      battleMemory.setProblems(battleId, startedBattle.problems);

      // Get initial stats
      const initialStats = await teamBattleService.getBattleStats(battleId);

      // Notify all players
      io.to(`team-battle-${battle.battleCode}`).emit('team-battle-started', {
        battle: startedBattle,
        stats: initialStats,
        startTime,
        endTime,
      });

      console.log(`✅ Team battle started: ${battle.battleCode}`);
      console.log('🔄 About to call startBattlePolling...');
      
      // Start polling for submissions
      startBattlePolling(io, startedBattle);
      
      console.log('✅ startBattlePolling call completed');

    } catch (error) {
      console.error('Start team battle error:', error);
      io.to(`team-battle-${data.battleId}`).emit('error', { 
        message: error.message || 'Failed to start battle' 
      });
    }
  });

  /**
   * Get team battle updates (force poll)
   */
  socket.on('get-team-battle-update', async (data) => {
    try {
      if (!socket.userId) return;

      const { battleId } = data;

      // Try memory first
      let battle = battleMemory.getBattleById(battleId);
      
      if (!battle) {
        battle = await teamBattleService.getBattleWithDetails(battleId);
      }
      
      if (!battle) return;

      const stats = await teamBattleService.getBattleStats(battleId);

      socket.emit('team-battle-update', {
        battle,
        stats,
      });
    } catch (error) {
      console.error('Get team battle update error:', error);
    }
  });
};

/**
 * Select problems from Codeforces based on battle configuration
 */
async function selectProblemsForBattle(battle) {
  const problems = battle.problems;
  const selectedProblems = [];

  for (const problemConfig of problems) {
    if (problemConfig.useCustomLink) {
      // Custom link - parse if it's a Codeforces link, otherwise skip selection
      const cfMatch = problemConfig.customLink.match(/codeforces\.com\/(?:contest|problemset\/problem)\/(\d+)\/([A-Z]\d?)/i);
      
      if (cfMatch) {
        selectedProblems.push({
          problemIndex: problemConfig.problemIndex,
          contestId: parseInt(cfMatch[1]),
          index: cfMatch[2].toUpperCase(),
          name: 'Custom Problem',
          rating: null,
        });
      } else {
        // External link, store as-is
        selectedProblems.push({
          problemIndex: problemConfig.problemIndex,
          contestId: null,
          index: null,
          name: 'External Problem',
          rating: null,
        });
      }
    } else {
      // Select from Codeforces based on rating
      let rating, ratingMin, ratingMax;

      if (problemConfig.useRange) {
        ratingMin = problemConfig.ratingMin;
        ratingMax = problemConfig.ratingMax;
      } else {
        rating = problemConfig.rating;
        ratingMin = rating - 100;
        ratingMax = rating + 100;
      }

      // Get players' CF handles to avoid solved problems
      const cfHandles = battle.players.map(p => p.cfHandle).filter(Boolean);

      const problem = await codeforcesService.selectRandomUnsolvedProblemForTeamBattle(
        ratingMin,
        ratingMax,
        [],
        problemConfig.minYear || null,
        cfHandles
      );

      selectedProblems.push({
        problemIndex: problemConfig.problemIndex,
        contestId: problem.contestId,
        index: problem.index,
        name: problem.name,
        rating: problem.rating,
      });
    }
  }

  return selectedProblems;
}

/**
 * Start polling for battle submissions - OPTIMIZED
 */
function startBattlePolling(io, battle) {
  const pollInterval = parseInt(process.env.SUBMISSION_POLL_INTERVAL_SECONDS) || 10;

  console.log(`🔄 Starting polling for team battle: ${battle.battleCode}`);

  // Clear existing poll if any
  if (activePolls.has(battle.id)) {
    clearInterval(activePolls.get(battle.id));
    console.log('Cleared existing poll');
  }

  let pollCount = 0;

  const intervalId = setInterval(async () => {
    pollCount++;
    console.log(`\n🔄 POLL #${pollCount} at ${new Date().toLocaleTimeString()}`);
    
    try {
      // Get from memory first
      let currentBattle = battleMemory.getBattleById(battle.id);
      
      if (!currentBattle) {
        // Fallback to database
        currentBattle = await prisma.teamBattle.findUnique({
          where: { id: battle.id },
          include: {
            players: true,
            problems: true,
          },
        });

        if (currentBattle) {
          battleMemory.addBattle(currentBattle);
        }
      }

      if (!currentBattle) {
        console.log(`⚠️ Battle ${battle.id} not found, stopping poll`);
        stopBattlePolling(battle.id);
        return;
      }

      if (currentBattle.status !== 'active') {
        console.log(`⚠️ Battle ${currentBattle.battleCode} no longer active, stopping poll`);
        stopBattlePolling(battle.id);
        return;
      }

      // Check if battle expired
      const now = new Date();
      if (currentBattle.endTime && now >= new Date(currentBattle.endTime)) {
        console.log(`⏱️ Battle ${battle.battleCode} time expired`);
        await handleBattleEnd(io, currentBattle);
        stopBattlePolling(battle.id);
        return;
      }

      // Poll for new submissions
      const results = await teamBattlePollingService.pollBattleSubmissions(currentBattle);

      if (results.length === 0) {
        return;
      }

      console.log(`📊 Found ${results.length} new solve(s) in battle ${currentBattle.battleCode}`);

      // Update memory FIRST for instant feedback
      let memoryUpdated = false;
      for (const result of results) {
        const { updated } = battleMemory.updateProblemSolved(
          currentBattle.id,
          result.problemIndex,
          result.solvedBy,
          result.userId,
          result.username
        );
        
        if (updated) {
          memoryUpdated = true;
        }
      }

      if (memoryUpdated) {
        // Get updated battle from memory
        const updatedBattle = battleMemory.getBattleById(currentBattle.id);
        
        // Calculate stats from memory
        const stats = {
          teamAScore: updatedBattle.problems.filter(p => p.solvedBy === 'A').reduce((sum, p) => sum + p.points, 0),
          teamBScore: updatedBattle.problems.filter(p => p.solvedBy === 'B').reduce((sum, p) => sum + p.points, 0),
          problemsSolved: {
            teamA: updatedBattle.problems.filter(p => p.solvedBy === 'A').length,
            teamB: updatedBattle.problems.filter(p => p.solvedBy === 'B').length,
          }
        };

        console.log(`📢 Emitting update for battle ${currentBattle.battleCode}`);
        console.log(`   Team A: ${stats.teamAScore} pts | Team B: ${stats.teamBScore} pts`);

        // 🚀 INSTANT BROADCAST from memory
        io.to(`team-battle-${currentBattle.battleCode}`).emit('team-battle-update', {
          battle: updatedBattle,
          stats,
          newSolves: results,
        });

        // Update database async
        for (const result of results) {
          teamBattleService.updateProblemSolved(
            currentBattle.id,
            result.problemIndex,
            result.solvedBy,
            result.userId,
            result.username
          ).catch(err => console.error('❌ Database update failed:', err));
        }

        // Check if all problems solved
        const allSolved = updatedBattle.problems.every(p => p.solvedBy !== null);
        if (allSolved) {
          console.log(`✅ All problems solved in battle ${battle.battleCode}`);
          await handleBattleEnd(io, updatedBattle);
          stopBattlePolling(battle.id);
        }
      }
    } catch (error) {
      console.error(`❌ Polling error for battle ${battle.id}:`, error.message);
      console.error(error.stack);
    }
  }, pollInterval * 1000);

  activePolls.set(battle.id, intervalId);
}

/**
 * Stop polling for a battle
 */
function stopBattlePolling(battleId) {
  if (activePolls.has(battleId)) {
    clearInterval(activePolls.get(battleId));
    activePolls.delete(battleId);
    console.log(`🛑 Stopped polling for battle: ${battleId}`);
  }
}

/**
 * Handle battle end
 */
async function handleBattleEnd(io, battle) {
  try {
    console.log(`🏁 Ending battle: ${battle.battleCode}`);

    // Get stats from memory
    const memoryBattle = battleMemory.getBattleById(battle.id);
    let stats;
    
    if (memoryBattle) {
      stats = {
        teamAScore: memoryBattle.problems.filter(p => p.solvedBy === 'A').reduce((sum, p) => sum + p.points, 0),
        teamBScore: memoryBattle.problems.filter(p => p.solvedBy === 'B').reduce((sum, p) => sum + p.points, 0),
        problemsSolved: {
          teamA: memoryBattle.problems.filter(p => p.solvedBy === 'A').length,
          teamB: memoryBattle.problems.filter(p => p.solvedBy === 'B').length,
        }
      };
    } else {
      // Fallback to database stats if not in memory
      stats = await teamBattleService.getBattleStats(battle.id);
    }

    let winningTeam = null;

    if (stats.teamAScore > stats.teamBScore) {
      winningTeam = 'A';
    } else if (stats.teamBScore > stats.teamAScore) {
      winningTeam = 'B';
    }
    // else: Draw (winningTeam = null)

    await teamBattleService.completeBattle(battle.id, winningTeam);

    // Update memory
    battleMemory.updateBattleStatus(battle.id, 'completed', { winningTeam });

    const finalBattle = battleMemory.getBattleById(battle.id) || await teamBattleService.getBattleWithDetails(battle.id);

    // Notify all players
    io.to(`team-battle-${battle.battleCode}`).emit('team-battle-ended', {
      battle: finalBattle,
      stats,
      winningTeam,
      isDraw: winningTeam === null,
    });

    console.log(`✅ Battle ${battle.battleCode} completed. Winner: ${winningTeam || 'DRAW'}`);

    // Remove from memory after a delay
    setTimeout(() => {
      battleMemory.removeBattle(battle.id);
    }, 60000); // Keep in memory for 1 minute after end

  } catch (error) {
    console.error('Handle battle end error:', error);
  }
}

/**
 * Check for expired battles periodically
 */
function startExpiredBattlesCheck(io) {
  setTimeout(() => {
    setInterval(async () => {
      try {
        const prisma = require('../config/database.config');
        
        if (!prisma || !prisma.teamBattle) {
          console.warn('⚠️ Prisma not ready yet, skipping expired battles check');
          return;
        }
        
        // Check memory first
        const memoryBattles = battleMemory.getAllBattles();
        const now = new Date();

        for (const battle of memoryBattles) {
          if (battle.status === 'active' && battle.endTime && now >= new Date(battle.endTime)) {
            console.log(`⏱️ Found expired battle in memory: ${battle.battleCode}`);
            await handleBattleEnd(io, battle);
            stopBattlePolling(battle.id);
          }
        }

        // Also check database for any battles not in memory
        const activeBattles = await prisma.teamBattle.findMany({
          where: { status: 'active' },
          include: {
            players: true,
            problems: true,
          },
        });

        for (const battle of activeBattles) {
          if (!battleMemory.getBattleById(battle.id)) {
            // Not in memory, add it
            battleMemory.addBattle(battle);
          }

          if (battle.endTime && now >= new Date(battle.endTime)) {
            console.log(`⏱️ Found expired battle: ${battle.battleCode}`);
            await handleBattleEnd(io, battle);
            stopBattlePolling(battle.id);
          }
        }
      } catch (error) {
        console.error('Error checking expired battles:', error);
      }
    }, 30000); // Every 30 seconds
  }, 5000); // Wait 5 seconds before starting
}

module.exports = {
  initializeTeamBattleSocket,
  startExpiredBattlesCheck,
  stopBattlePolling,
};