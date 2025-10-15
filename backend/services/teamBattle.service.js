const prisma = require('../config/database.config');
const { generateRoomCode } = require('../utils/helpers.util');

class TeamBattleService {
  /**
   * Create a new team battle room
   */
  async createBattle(creatorId, creatorData, settings) {
    const { duration, numProblems, problems } = settings;

    // Generate unique battle code
    const battleCode = await this.generateUniqueBattleCode();

    // Create battle
    const battle = await prisma.teamBattle.create({
      data: {
        battleCode,
        creatorId,
        duration,
        numProblems,
        status: 'waiting',
      },
    });

    // Create problem configurations
    const problemData = problems.map((prob, index) => ({
      battleId: battle.id,
      problemIndex: index,
      points: prob.points || 100,
      useCustomLink: prob.useCustomLink,
      customLink: prob.customLink,
      rating: prob.rating,
      useRange: prob.useRange,
      ratingMin: prob.ratingMin,
      ratingMax: prob.ratingMax,
      minYear: prob.minYear,
    }));

    await prisma.teamBattleProblem.createMany({
      data: problemData,
    });

    // Add creator as first player in Team A
    await prisma.teamBattlePlayer.create({
      data: {
        battleId: battle.id,
        userId: creatorId,
        username: creatorData.username,
        cfHandle: creatorData.cfHandle || creatorData.username,
        rating: creatorData.rating || 0,
        team: 'A',
        position: 0,
        isCreator: true,
      },
    });

    return this.getBattleWithDetails(battle.id);
  }

  /**
   * Join a team battle
   */
  async joinBattle(battleCode, userId, username, cfHandle, rating) {
    const battle = await prisma.teamBattle.findUnique({
      where: { battleCode },
      include: { players: true },
    });

    if (!battle) {
      throw new Error('Battle not found');
    }

    if (battle.status !== 'waiting') {
      throw new Error('Battle has already started');
    }

    // Check if user already in battle
    const existingPlayer = battle.players.find(p => p.userId === userId);
    if (existingPlayer) {
      throw new Error('You are already in this battle');
    }

    // Check if battle is full (8 players max)
    if (battle.players.length >= 8) {
      throw new Error('Battle is full');
    }

    // Auto-assign to team with fewer players
    const teamACounts = battle.players.filter(p => p.team === 'A').length;
    const teamBCounts = battle.players.filter(p => p.team === 'B').length;
    const assignedTeam = teamACounts <= teamBCounts ? 'A' : 'B';

    // Find next available position in team
    const teamPlayers = battle.players.filter(p => p.team === assignedTeam);
    const usedPositions = teamPlayers.map(p => p.position);
    let position = 0;
    while (usedPositions.includes(position) && position < 4) {
      position++;
    }

    await prisma.teamBattlePlayer.create({
      data: {
        battleId: battle.id,
        userId,
        username,
        cfHandle,
        rating,
        team: assignedTeam,
        position,
      },
    });

    return this.getBattleWithDetails(battle.id);
  }

  /**
   * Move player to different slot
   */
  async movePlayer(battleId, userId, newTeam, newPosition) {
    const battle = await prisma.teamBattle.findUnique({
      where: { id: battleId },
      include: { players: true },
    });

    if (!battle || battle.status !== 'waiting') {
      throw new Error('Cannot move player');
    }

    // Check if target slot is empty
    const targetSlot = battle.players.find(
      p => p.team === newTeam && p.position === newPosition
    );

    if (targetSlot) {
      throw new Error('Slot is already occupied');
    }

    // Update player position
    await prisma.teamBattlePlayer.updateMany({
      where: {
        battleId,
        userId,
      },
      data: {
        team: newTeam,
        position: newPosition,
      },
    });

    return this.getBattleWithDetails(battleId);
  }

  /**
   * Remove player from battle
   */
  async removePlayer(battleId, creatorId, targetUserId) {
    const battle = await prisma.teamBattle.findUnique({
      where: { id: battleId },
      include: { players: true },
    });

    if (!battle) {
      throw new Error('Battle not found');
    }

    // Verify creator
    if (battle.creatorId !== creatorId) {
      throw new Error('Only creator can remove players');
    }

    if (battle.status !== 'waiting') {
      throw new Error('Cannot remove players after battle starts');
    }

    // Cannot remove creator
    if (targetUserId === creatorId) {
      throw new Error('Creator cannot be removed');
    }

    await prisma.teamBattlePlayer.deleteMany({
      where: {
        battleId,
        userId: targetUserId,
      },
    });

    return this.getBattleWithDetails(battleId);
  }

  /**
   * Leave team battle
   * User voluntarily leaves the battle
   */
  async leaveBattle(battleId, userId) {
    const battle = await prisma.teamBattle.findUnique({
      where: { id: battleId },
      include: { players: true },
    });

    console.log('🔍 Leave Battle Debug:');
    console.log('  - Battle ID:', battleId);
    console.log('  - User ID:', userId, 'Type:', typeof userId);
    console.log('  - Battle found:', battle ? 'Yes' : 'No');
    
    if (!battle) {
      throw new Error('Battle not found');
    }

    if (battle.players.length === 0) {
      console.log('  - ⚠️ WARNING: Battle has no players!');
      console.log('  - This battle may be orphaned or the user already left');
      // Allow leaving orphaned battles
      return { deleted: false, alreadyLeft: true };
    }

    console.log('  - Players in battle:', battle.players.map(p => ({
      userId: p.userId,
      username: p.username,
      type: typeof p.userId,
      match: p.userId === userId,
      stringMatch: String(p.userId) === String(userId)
    })));

    // Check if user is in the battle - try multiple comparison methods
    let player = battle.players.find(p => p.userId === userId);
    
    if (!player) {
      // Try string comparison
      player = battle.players.find(p => String(p.userId) === String(userId));
    }
    
    if (!player) {
      // Try number comparison if possible
      const numUserId = Number(userId);
      if (!isNaN(numUserId)) {
        player = battle.players.find(p => Number(p.userId) === numUserId);
      }
    }
    
    if (!player) {
      console.log('  - ❌ Player not found in battle after all comparison attempts');
      throw new Error('You are not in this battle');
    }
    
    console.log('  - ✅ Player found:', player.username);
    console.log('  - Using player.userId for deletion:', player.userId, typeof player.userId);

    // Cannot leave if battle is active
    if (battle.status === 'active') {
      throw new Error('Cannot leave battle while it is active');
    }

    // If user is creator and there are other players, transfer ownership or delete battle
    if (String(battle.creatorId) === String(userId)) {
      if (battle.players.length > 1) {
        // Transfer ownership to another player
        const newCreator = battle.players.find(p => String(p.userId) !== String(userId));
        
        await prisma.teamBattle.update({
          where: { id: battleId },
          data: {
            creatorId: newCreator.userId,
          },
        });
      } else {
        // Creator is the only player, delete the battle
        await prisma.teamBattleProblem.deleteMany({
          where: { battleId },
        });
        
        await prisma.teamBattlePlayer.deleteMany({
          where: { battleId },
        });
        
        await prisma.teamBattle.delete({
          where: { id: battleId },
        });
        
        return { deleted: true };
      }
    }

    // Remove player from battle using the exact userId from the player record
    await prisma.teamBattlePlayer.deleteMany({
      where: {
        battleId,
        userId: player.userId, // Use the exact userId from the found player
      },
    });

    console.log('  - ✅ Player removed successfully');
    return { deleted: false };
  }

  /**
   * Start team battle
   */
  async startBattle(battleId, creatorId) {
    const battle = await prisma.teamBattle.findUnique({
      where: { id: battleId },
      include: { players: true, problems: true },
    });

    if (!battle) {
      throw new Error('Battle not found');
    }

    if (battle.creatorId !== creatorId) {
      throw new Error('Only creator can start battle');
    }

    if (battle.status !== 'waiting') {
      throw new Error('Battle already started');
    }

    // Check minimum players
    const teamACount = battle.players.filter(p => p.team === 'A').length;
    const teamBCount = battle.players.filter(p => p.team === 'B').length;

    if (teamACount === 0 || teamBCount === 0) {
      throw new Error('Both teams must have at least one player');
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + battle.duration * 60 * 1000);

    await prisma.teamBattle.update({
      where: { id: battleId },
      data: {
        status: 'active',
        startTime,
        endTime,
      },
    });

    return { startTime, endTime };
  }

  /**
   * Complete team battle
   */
  async completeBattle(battleId, winningTeam) {
    await prisma.teamBattle.update({
      where: { id: battleId },
      data: {
        status: 'completed',
        winningTeam,
      },
    });
  }

  /**
   * Get battle with full details
   */
  async getBattleWithDetails(battleId) {
    return prisma.teamBattle.findUnique({
      where: { id: battleId },
      include: {
        players: {
          orderBy: [{ team: 'asc' }, { position: 'asc' }],
        },
        problems: {
          orderBy: { problemIndex: 'asc' },
        },
      },
    });
  }

  /**
   * Get battle by code
   */
  async getBattleByCode(battleCode) {
    return prisma.teamBattle.findUnique({
      where: { battleCode },
      include: {
        players: {
          orderBy: [{ team: 'asc' }, { position: 'asc' }],
        },
        problems: {
          orderBy: { problemIndex: 'asc' },
        },
      },
    });
  }

  /**
   * Generate unique battle code
   */
  async generateUniqueBattleCode() {
    let battleCode;
    let exists = true;

    while (exists) {
      battleCode = generateRoomCode(8);
      const existing = await prisma.teamBattle.findUnique({
        where: { battleCode },
      });
      exists = !!existing;
    }

    return battleCode;
  }

  /**
 * Update problem solve status
 * Returns true if update was successful, false if already solved
 */
async updateProblemSolved(battleId, problemIndex, team, userId, username) {
  // First, check if problem is already solved
  const problem = await prisma.teamBattleProblem.findFirst({
    where: {
      battleId,
      problemIndex,
    },
  });

  if (!problem) {
    console.log(`⚠️ Problem not found: battleId=${battleId}, problemIndex=${problemIndex}`);
    return false;
  }

  if (problem.solvedBy !== null) {
    console.log(`⚠️ Problem ${problemIndex} already solved by Team ${problem.solvedBy}`);
    return false;
  }

  // Update the problem
  const updated = await prisma.teamBattleProblem.update({
    where: {
      battleId_problemIndex: {
        battleId,
        problemIndex,
      },
    },
    data: {
      solvedBy: team,
      solvedByUserId: userId,
      solvedByUsername: username,
      solvedAt: new Date(),
    },
  });

  console.log(`✅ Problem ${problemIndex} marked as solved by ${username} (Team ${team})`);
  return true;
}

  /**
   * Record attempt
   */
  async recordAttempt(battleId, userId, username, team, problemIndex, submissionId, verdict, timestamp) {
    try {
      await prisma.teamBattleAttempt.create({
        data: {
          battleId,
          userId,
          username,
          team,
          problemIndex,
          submissionId,
          verdict,
          timestamp,
        },
      });
    } catch (error) {
      // Ignore duplicate submission errors
      if (!error.message.includes('Unique constraint')) {
        throw error;
      }
    }
  }

  /**
   * Get battle statistics
   */
  async getBattleStats(battleId) {
    const battle = await this.getBattleWithDetails(battleId);
    
    if (!battle) {
      return null;
    }

    const teamAScore = battle.problems
      .filter(p => p.solvedBy === 'A')
      .reduce((sum, p) => sum + p.points, 0);

    const teamBScore = battle.problems
      .filter(p => p.solvedBy === 'B')
      .reduce((sum, p) => sum + p.points, 0);

    return {
      teamAScore,
      teamBScore,
      problemsSolved: {
        teamA: battle.problems.filter(p => p.solvedBy === 'A').length,
        teamB: battle.problems.filter(p => p.solvedBy === 'B').length,
      },
    };
  }
}

module.exports = new TeamBattleService();