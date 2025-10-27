const teamBattleService = require('../services/teamBattle.service');
const userService = require('../services/user.service');
const battleMemory = require('../socket/teamBattleMemory');
const prisma = require('../config/database.config');

/**
 * Create a new team battle room
 */
exports.createTeamBattle = async (req, res) => {
  try {
    const userId = req.user.id;
    const { duration, numProblems, problems, winningStrategy } = req.body; // UPDATED: Added winningStrategy

    if (!duration || !numProblems || !problems || !Array.isArray(problems)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    if (numProblems < 1 || numProblems > 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Number of problems must be between 1 and 6' 
      });
    }

    if (problems.length !== numProblems) {
      return res.status(400).json({ 
        success: false, 
        message: 'Number of problems does not match numProblems' 
      });
    }

    if (duration < 15 || duration > 180) {
      return res.status(400).json({ 
        success: false, 
        message: 'Duration must be between 15 and 180 minutes' 
      });
    }

    // UPDATED: Validate winning strategy
    if (winningStrategy && !['first-solve', 'total-solves'].includes(winningStrategy)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid winning strategy. Must be "first-solve" or "total-solves"' 
      });
    }

    for (let i = 0; i < problems.length; i++) {
      const prob = problems[i];
      
      if (prob.points === undefined || prob.points < 1 || prob.points > 1000) {
        return res.status(400).json({ 
          success: false, 
          message: `Problem ${i + 1}: Points must be between 1 and 1000` 
        });
      }

      if (prob.useCustomLink) {
        if (!prob.customLink || !prob.customLink.startsWith('http')) {
          return res.status(400).json({ 
            success: false, 
            message: `Problem ${i + 1}: Invalid custom link` 
          });
        }
      } else {
        if (prob.useRange) {
          if (!prob.ratingMin || !prob.ratingMax || prob.ratingMin > prob.ratingMax) {
            return res.status(400).json({ 
              success: false, 
              message: `Problem ${i + 1}: Invalid rating range` 
            });
          }
        } else {
          if (!prob.rating || prob.rating < 800 || prob.rating > 3500) {
            return res.status(400).json({ 
              success: false, 
              message: `Problem ${i + 1}: Invalid rating` 
            });
          }
        }
      }
    }

    const battle = await teamBattleService.createBattle(userId, {
      duration,
      numProblems,
      problems,
      winningStrategy: winningStrategy || 'first-solve', // UPDATED: Pass winning strategy with default
    });

    res.status(201).json({
      success: true,
      battle,
    });
  } catch (error) {
    console.error('Create team battle error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to create team battle' 
    });
  }
};

/**
 * Get team battle by code
 */
exports.getTeamBattle = async (req, res) => {
  try {
    const { code } = req.params;

    if (!code || code.length !== 8) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid battle code' 
      });
    }

    const battle = await teamBattleService.getBattleByCode(code);

    if (!battle) {
      return res.status(404).json({ 
        success: false, 
        message: 'Battle not found' 
      });
    }

    let stats = null;
    if (battle.status === 'active' || battle.status === 'completed') {
      stats = await teamBattleService.getBattleStats(battle.id);
    }

    res.json({
      success: true,
      battle,
      stats,
    });
  } catch (error) {
    console.error('Get team battle error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get team battle' 
    });
  }
};

/**
 * Join team battle
 */
exports.joinTeamBattle = async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.params;

    console.log('📥 JOIN REQUEST:', { userId, code });

    if (!code || code.length !== 8) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid battle code' 
      });
    }

    const user = await userService.findUserById(userId);
    
    if (!user || !user.cfHandle) {
      return res.status(400).json({ 
        success: false, 
        message: 'You must link your Codeforces handle to join team battles' 
      });
    }

    // Join battle via service
    const battle = await teamBattleService.joinBattle(
      code,
      userId,
      user.username,
      user.cfHandle,
      user.rating
    );

    console.log('✅ User joined battle (DB updated):', { 
      userId, 
      username: user.username, 
      battleCode: code,
      totalPlayers: battle.players.length 
    });

    // Update memory
    battleMemory.addBattle(battle);
    console.log('✅ Battle added to memory');

    // ✅ CRITICAL: Broadcast to ALL players in the room
    const io = req.app.get('io');
    
    if (io) {
      console.log('📢 Broadcasting player join to room:', code);
      console.log('   - Total players in battle:', battle.players.length);
      console.log('   - Player names:', battle.players.map(p => p.username).join(', '));
      
      // Emit to everyone in the room (including the joiner)
      io.to(`team-battle-${code}`).emit('team-battle-updated', {
        battle: battle,
      });
      
      console.log('✅ Broadcast sent to team-battle-' + code);
      
      // Also emit directly to the joining user (redundant but ensures they get it)
      io.to(`team-battle-${code}`).emit('team-battle-state', {
        battle: battle,
      });
      
      console.log('✅ State update sent to team-battle-' + code);
    } else {
      console.error('❌ CRITICAL: IO instance not available! Cannot broadcast.');
      console.error('   Make sure app.set("io", io) is called in server.js');
    }

    // Send response to HTTP request
    res.json({
      success: true,
      battle,
    });
  } catch (error) {
    console.error('❌ Join team battle error:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to join team battle' 
    });
  }
};

/**
 * Get team battle stats
 */
exports.getTeamBattleStats = async (req, res) => {
  try {
    const { battleId } = req.params;

    const stats = await teamBattleService.getBattleStats(battleId);

    if (!stats) {
      return res.status(404).json({ 
        success: false, 
        message: 'Battle not found' 
      });
    }

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Get team battle stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get battle stats' 
    });
  }
};

/**
 * Get user's active team battle
 */
exports.getActiveTeamBattle = async (req, res) => {
  try {
    const userId = req.user.id;

    // ✅ REMOVED duplicate prisma import - use the one from top of file
    const activeBattle = await prisma.teamBattle.findFirst({
      where: {
        status: {
          in: ['waiting', 'active']
        },
        players: {
          some: {
            userId: userId
          }
        }
      },
      include: {
        players: {
          orderBy: [{ team: 'asc' }, { position: 'asc' }],
        },
        problems: {
          orderBy: { problemIndex: 'asc' },
        },
      },
    });

    if (!activeBattle) {
      return res.json({ 
        success: true, 
        battle: null 
      });
    }

    let stats = null;
    if (activeBattle.status === 'active') {
      stats = await teamBattleService.getBattleStats(activeBattle.id);
    }

    res.json({
      success: true,
      battle: activeBattle,
      stats,
    });
  } catch (error) {
    console.error('Get active team battle error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get active team battle' 
    });
  }
};

/**
 * Leave team battle - FINAL FIX
 */
exports.leaveTeamBattle = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    console.log('═══════════════════════════════════════');
    console.log('🚪 CONTROLLER: LEAVE TEAM BATTLE REQUEST');
    console.log('═══════════════════════════════════════');
    console.log('   Battle ID:', id);
    console.log('   User ID:', userId);

    // Get battle info BEFORE leaving
    const battleBefore = await prisma.teamBattle.findUnique({
      where: { id },
      include: { 
        players: true,
        problems: true 
      }
    });

    if (!battleBefore) {
      console.log('❌ Battle not found');
      return res.status(404).json({ 
        success: false, 
        message: 'Battle not found' 
      });
    }

    const battleCode = battleBefore.battleCode;
    const io = req.app.get('io');

    console.log('📋 Battle Info:');
    console.log('   Code:', battleCode);
    console.log('   Status:', battleBefore.status);
    console.log('   Players:', battleBefore.players.length);

    // CRITICAL: Check if battle is already completed
    if (battleBefore.status === 'completed') {
      console.log('⚠️ Battle already completed - allowing graceful leave');
      
      // Just send success response, don't try to process leave
      return res.json({
        success: true,
        message: 'Battle already ended',
        deleted: false,
        teamEliminated: false,
        alreadyCompleted: true,
      });
    }

    // Check if user is still in the battle
    const playerExists = battleBefore.players.find(p => 
      p.userId === userId || String(p.userId) === String(userId)
    );

    if (!playerExists) {
      console.log('⚠️ Player not in battle - already left');
      
      return res.json({
        success: true,
        message: 'Already left battle',
        deleted: false,
        teamEliminated: false,
        alreadyLeft: true,
      });
    }

    // Process the leave via service
    console.log('🔄 Calling teamBattleService.leaveBattle...');
    const result = await teamBattleService.leaveBattle(id, userId);

    console.log('✅ SERVICE RETURNED:');
    console.log('   deleted:', result.deleted);
    console.log('   teamEliminated:', result.teamEliminated);
    console.log('   battleEnded:', result.battleEnded);
    console.log('   winningTeam:', result.winningTeam);
    console.log('   eliminatedTeam:', result.eliminatedTeam);

    // CASE 1: Battle was deleted (creator left waiting room with only themselves)
    if (result.deleted) {
      console.log('🗑️ CASE 1: BATTLE DELETED');
      
      if (battleCode && io) {
        io.to(`team-battle-${battleCode}`).emit('battle-deleted', {
          message: 'Room creator has closed the battle',
        });
      }

      const response = {
        success: true,
        message: 'Battle deleted',
        deleted: true,
        teamEliminated: false,
      };
      
      console.log('📤 SENDING RESPONSE:', JSON.stringify(response));
      console.log('═══════════════════════════════════════\n');
      return res.json(response);
    }

    // CASE 2: Team eliminated - battle ended
    if (result.teamEliminated === true && result.battleEnded === true) {
      console.log('🏆 CASE 2: TEAM ELIMINATION DETECTED!');
      console.log('   Winning Team:', result.winningTeam);
      console.log('   Eliminated Team:', result.eliminatedTeam);

      // Stop polling - FIXED: Load module dynamically to avoid circular dependency
      try {
        const { stopBattlePolling } = require('../socket/teamBattleSocket');
        stopBattlePolling(id);
        console.log('   ✅ Polling stopped');
      } catch (err) {
        console.log('   ⚠️ Could not stop polling (module not loaded):', err.message);
      }

      // Get final battle state
      const finalBattle = await teamBattleService.getBattleWithDetails(id);
      const finalStats = await teamBattleService.getBattleStats(id);
      console.log('   ✅ Final battle state fetched');

      // Emit socket event to ALL players
      if (battleCode && io) {
        console.log('   📢 Emitting team-battle-ended to room:', battleCode);
        
        io.to(`team-battle-${battleCode}`).emit('team-battle-ended', {
          battle: finalBattle,
          stats: finalStats,
          winningTeam: result.winningTeam,
          isDraw: false,
          teamEliminated: true,
          eliminatedTeam: result.eliminatedTeam,
          reason: `Team ${result.eliminatedTeam} forfeited - all players left`,
        });
        
        console.log('   ✅ Socket event emitted');
      }

      // Wait for socket event to be received
      console.log('   ⏳ Waiting 500ms for socket delivery...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Build response object
      const response = {
        success: true,
        message: 'Team eliminated - battle ended',
        deleted: false,
        teamEliminated: true,
        winningTeam: result.winningTeam,
        eliminatedTeam: result.eliminatedTeam,
      };
      
      console.log('📤 SENDING RESPONSE WITH TEAM ELIMINATION:');
      console.log(JSON.stringify(response, null, 2));
      console.log('═══════════════════════════════════════\n');
      
      return res.json(response);
    }

    // CASE 3: Normal leave - battle continues
    console.log('✅ CASE 3: NORMAL LEAVE (battle continues)');
    
    const updatedBattle = await teamBattleService.getBattleWithDetails(id);
    
    if (updatedBattle && io) {
      battleMemory.addBattle(updatedBattle);
      io.to(`team-battle-${battleCode}`).emit('team-battle-updated', {
        battle: updatedBattle,
      });
      console.log('   ✅ Updated battle broadcasted');
    }

    const response = {
      success: true,
      message: 'Left battle successfully',
      deleted: false,
      teamEliminated: false,
    };
    
    console.log('📤 SENDING NORMAL LEAVE RESPONSE:');
    console.log(JSON.stringify(response, null, 2));
    console.log('═══════════════════════════════════════\n');

    return res.json(response);

  } catch (error) {
    console.error('❌ CONTROLLER ERROR:', error);
    console.log('═══════════════════════════════════════\n');
    
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to leave team battle' 
    });
  }
};