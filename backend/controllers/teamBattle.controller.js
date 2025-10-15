const teamBattleService = require('../services/teamBattle.service');
const userService = require('../services/user.service');

/**
 * Create a new team battle room
 */
exports.createTeamBattle = async (req, res) => {
  try {
    const userId = req.user.id;
    const { duration, numProblems, problems } = req.body;

    // Validation
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

    // Validate each problem configuration
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
        // Rating-based problem
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

    // Get battle stats if active or completed
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

    if (!code || code.length !== 8) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid battle code' 
      });
    }

    // Get user info
    const user = await userService.findUserById(userId);
    
    if (!user || !user.cfHandle) {
      return res.status(400).json({ 
        success: false, 
        message: 'You must link your Codeforces handle to join team battles' 
      });
    }

    const battle = await teamBattleService.joinBattle(
      code,
      userId,
      user.username,
      user.cfHandle,
      user.rating
    );

    res.json({
      success: true,
      battle,
    });
  } catch (error) {
    console.error('Join team battle error:', error);
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

    // Find active battle where user is a player
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

    // Get stats if active
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
 * Leave team battle (only in waiting status)
 */
exports.leaveTeamBattle = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const prisma = require('../config/database.config');
    const battle = await prisma.teamBattle.findUnique({
      where: { id },
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

    // If user is creator, delete the entire battle
    if (battle.creatorId === userId) {
      await prisma.teamBattle.delete({
        where: { id },
      });

      return res.json({
        success: true,
        message: 'Battle deleted',
      });
    }

    // Otherwise, just remove the player
    await prisma.teamBattlePlayer.deleteMany({
      where: {
        battleId: id,
        userId,
      },
    });

    res.json({
      success: true,
      message: 'Left battle successfully',
    });
  } catch (error) {
    console.error('Leave team battle error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to leave team battle' 
    });
  }
};
