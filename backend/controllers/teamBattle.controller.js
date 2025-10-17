const teamBattleService = require('../services/teamBattle.service');
const userService = require('../services/user.service');
const battleMemory = require('../socket/teamBattleMemory');

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

    const prisma = require('../config/database.config');
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
 * Leave team battle
 */
exports.leaveTeamBattle = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    console.log('🚪 LEAVE REQUEST:', { battleId: id, userId });

    const prisma = require('../config/database.config');
    
    const battle = await prisma.teamBattle.findUnique({
      where: { id },
      include: {
        players: true,
      },
    });

    if (!battle) {
      return res.status(404).json({ 
        success: false, 
        message: 'Battle not found' 
      });
    }

    if (battle.status !== 'waiting') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot leave battle after it has started' 
      });
    }

    const io = req.app.get('io');

    // If creator leaves, delete the entire battle
    if (battle.creatorId === userId) {
      console.log('🗑️ Creator leaving, deleting battle');

      await prisma.teamBattle.delete({
        where: { id },
      });

      battleMemory.removeBattle(id);

      if (io) {
        io.to(`team-battle-${battle.battleCode}`).emit('battle-deleted', {
          message: 'Room creator has closed the battle',
        });
        
        console.log('📢 Broadcast battle-deleted to room:', battle.battleCode);
      }

      return res.json({
        success: true,
        message: 'Battle deleted',
        deleted: true,
      });
    }

    // Regular player leaving
    console.log('👤 Regular player leaving...');

    await prisma.teamBattlePlayer.deleteMany({
      where: {
        battleId: id,
        userId,
      },
    });

    console.log('✅ Player removed from database');

    // Fetch updated battle state
    const updatedBattle = await prisma.teamBattle.findUnique({
      where: { id },
      include: {
        players: {
          orderBy: [{ team: 'asc' }, { position: 'asc' }],
        },
        problems: {
          orderBy: { problemIndex: 'asc' },
        },
      },
    });

    if (updatedBattle) {
      // Update memory
      battleMemory.addBattle(updatedBattle);
      console.log('✅ Memory updated with fresh battle data');
      console.log('   Remaining players:', updatedBattle.players.length);

      // ✅ Broadcast update to remaining players
      if (io) {
        io.to(`team-battle-${battle.battleCode}`).emit('team-battle-updated', {
          battle: updatedBattle,
        });
        console.log('📢 Broadcasted player leave to remaining players in room:', battle.battleCode);
      } else {
        console.warn('⚠️ IO not available, remaining players won\'t see the update immediately');
      }
    }

    res.json({
      success: true,
      message: 'Left battle successfully',
      deleted: false,
    });
  } catch (error) {
    console.error('❌ Leave team battle error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to leave team battle' 
    });
  }
};