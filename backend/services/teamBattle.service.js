const prisma = require('../config/database.config');
const { generateRoomCode } = require('../utils/helpers.util');

class TeamBattleService {
  /**
   * Create a new team battle room
   */
  async createBattle(creatorId, creatorData, settings) {
    const { duration, numProblems, problems, winningStrategy } = settings; // UPDATED: added winningStrategy

    // Generate unique battle code
    const battleCode = await this.generateUniqueBattleCode();

    // Create battle
    const battle = await prisma.teamBattle.create({
      data: {
        battleCode,
        creatorId,
        duration,
        numProblems,
        winningStrategy: winningStrategy || 'first-solve', // UPDATED: add winning strategy
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
   */
  async leaveBattle(battleId, userId) {
    const battle = await prisma.teamBattle.findUnique({
      where: { id: battleId },
      include: { players: true },
    });

    if (!battle) {
      throw new Error('Battle not found');
    }

    if (battle.players.length === 0) {
      return { deleted: false, alreadyLeft: true };
    }

    let player = battle.players.find(p => p.userId === userId);
    
    if (!player) {
      player = battle.players.find(p => String(p.userId) === String(userId));
    }
    
    if (!player) {
      throw new Error('You are not in this battle');
    }

    // Cannot leave if battle is active
    if (battle.status === 'active') {
      throw new Error('Cannot leave battle while it is active');
    }

    // If user is creator and there are other players, transfer ownership or delete battle
    if (String(battle.creatorId) === String(userId)) {
      if (battle.players.length > 1) {
        const newCreator = battle.players.find(p => String(p.userId) !== String(userId));
        
        await prisma.teamBattle.update({
          where: { id: battleId },
          data: {
            creatorId: newCreator.userId,
          },
        });
      } else {
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

    await prisma.teamBattlePlayer.deleteMany({
      where: {
        battleId,
        userId: player.userId,
      },
    });

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
   * Update problem solve status (for first-solve mode)
   */
  async updateProblemSolved(battleId, problemIndex, team, userId, username) {
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
   * NEW: Record individual solve (for total-solves mode)
   */
  async recordIndividualSolve(battleId, problemIndex, userId, username, team, points, solvedAt) {
    try {
      await prisma.teamBattleProblemSolve.create({
        data: {
          battleId,
          problemIndex,
          userId,
          username,
          team,
          points,
          solvedAt,
        },
      });
      return true;
    } catch (error) {
      if (error.code === 'P2002') {
        // Unique constraint violation - user already solved this problem
        return false;
      }
      throw error;
    }
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
      if (!error.message.includes('Unique constraint')) {
        throw error;
      }
    }
  }

  /**
   * UPDATED: Get battle statistics (handles both modes)
   */
  /**
 * Get battle stats with tie-breaking for total-solves mode
 */
async getBattleStats(battleId) {
  const battle = await prisma.teamBattle.findUnique({
    where: { id: battleId },
    select: { 
      winningStrategy: true,
      problems: true 
    }
  });

  if (!battle) {
    return null;
  }

  if (battle.winningStrategy === 'first-solve') {
    // First-solve mode: Simple point counting
    const problems = battle.problems;
    
    const teamAScore = problems
      .filter(p => p.solvedBy === 'A')
      .reduce((sum, p) => sum + p.points, 0);
    
    const teamBScore = problems
      .filter(p => p.solvedBy === 'B')
      .reduce((sum, p) => sum + p.points, 0);

    return {
      teamAScore,
      teamBScore,
      problemsSolved: {
        teamA: problems.filter(p => p.solvedBy === 'A').length,
        teamB: problems.filter(p => p.solvedBy === 'B').length,
      }
    };
  } else {
    // Total-solves mode: Sum all solves + tie-breaking info
    const teamASolves = await prisma.teamBattleProblemSolve.findMany({
      where: { battleId, team: 'A' },
      orderBy: { solvedAt: 'desc' },
      select: { points: true, solvedAt: true, problemIndex: true }
    });

    const teamBSolves = await prisma.teamBattleProblemSolve.findMany({
      where: { battleId, team: 'B' },
      orderBy: { solvedAt: 'desc' },
      select: { points: true, solvedAt: true, problemIndex: true }
    });

    const teamAScore = teamASolves.reduce((sum, s) => sum + s.points, 0);
    const teamBScore = teamBSolves.reduce((sum, s) => sum + s.points, 0);

    // Count unique problems solved by each team
    const teamAUniqueSolves = new Set(teamASolves.map(s => s.problemIndex)).size;
    const teamBUniqueSolves = new Set(teamBSolves.map(s => s.problemIndex)).size;

    // FIXED: Get LAST solve time (most recent, not first)
    // Since we ordered by 'desc', the first item is the most recent
    const teamALastSolve = teamASolves.length > 0 ? teamASolves[0].solvedAt : null;
    const teamBLastSolve = teamBSolves.length > 0 ? teamBSolves[0].solvedAt : null;

    return {
      teamAScore,
      teamBScore,
      problemsSolved: {
        teamA: teamAUniqueSolves,
        teamB: teamBUniqueSolves,
      },
      lastSolveTime: {
        teamA: teamALastSolve,
        teamB: teamBLastSolve,
      }
    };
  }
}

/**
 * Determine winner for total-solves mode with tie-breaking
 */
determineWinnerWithTieBreak(stats) {
  const { teamAScore, teamBScore, lastSolveTime } = stats;

  // FIXED: Added validation for lastSolveTime
  if (!lastSolveTime) {
    // Fallback for first-solve mode or missing data
    if (teamAScore > teamBScore) return 'A';
    if (teamBScore > teamAScore) return 'B';
    return null;
  }

  if (teamAScore > teamBScore) {
    return 'A';
  } else if (teamBScore > teamAScore) {
    return 'B';
  } else if (teamAScore === teamBScore && teamAScore > 0) {
    // Tie in points - check last solve time
    if (!lastSolveTime.teamA && !lastSolveTime.teamB) {
      return null; // Both teams have 0 points
    }
    
    if (!lastSolveTime.teamB) {
      return 'A'; // Only team A solved something
    }
    
    if (!lastSolveTime.teamA) {
      return 'B'; // Only team B solved something
    }

    // FIXED: Team with EARLIER last solve wins (finished faster)
    // Convert to timestamps for reliable comparison
    const teamATime = new Date(lastSolveTime.teamA).getTime();
    const teamBTime = new Date(lastSolveTime.teamB).getTime();
    return teamATime < teamBTime ? 'A' : 'B';
  }

  return null; // Draw (both 0 points)
}
}


module.exports = new TeamBattleService();