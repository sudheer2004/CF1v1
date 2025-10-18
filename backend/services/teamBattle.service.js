const prisma = require('../config/database.config');
const { generateRoomCode } = require('../utils/helpers.util');
const battleMemory = require('../socket/teamBattleMemory'); // ← CRITICAL: ADD THIS IMPORT

class TeamBattleService {
  /**
   * Create a new team battle room
   */
  async createBattle(creatorId, creatorData, settings) {
    const { duration, numProblems, problems, winningStrategy } = settings;

    const battleCode = await this.generateUniqueBattleCode();

    const battle = await prisma.teamBattle.create({
      data: {
        battleCode,
        creatorId,
        duration,
        numProblems,
        winningStrategy: winningStrategy || 'first-solve',
        status: 'waiting',
      },
    });

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

    const existingPlayer = battle.players.find(p => p.userId === userId);
    if (existingPlayer) {
      throw new Error('You are already in this battle');
    }

    if (battle.players.length >= 8) {
      throw new Error('Battle is full');
    }

    const teamACounts = battle.players.filter(p => p.team === 'A').length;
    const teamBCounts = battle.players.filter(p => p.team === 'B').length;
    const assignedTeam = teamACounts <= teamBCounts ? 'A' : 'B';

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

    const targetSlot = battle.players.find(
      p => p.team === newTeam && p.position === newPosition
    );

    if (targetSlot) {
      throw new Error('Slot is already occupied');
    }

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
   * Remove player from battle (updated with team elimination)
   */
  async removePlayer(battleId, requesterId, targetUserId) {
    const battle = await prisma.teamBattle.findUnique({
      where: { id: battleId },
      include: { players: true },
    });

    if (!battle) {
      throw new Error('Battle not found');
    }

    if (battle.creatorId !== requesterId) {
      throw new Error('Only creator can remove players');
    }

    const targetPlayer = battle.players.find(p => p.userId === targetUserId);
    if (!targetPlayer) {
      throw new Error('Player not found');
    }

    await prisma.teamBattlePlayer.deleteMany({
      where: {
        battleId,
        userId: targetUserId,
      },
    });

    // Check team elimination for active battles
    if (battle.status === 'active') {
      const remainingPlayers = await prisma.teamBattlePlayer.findMany({
        where: { battleId }
      });

      const teamACount = remainingPlayers.filter(p => p.team === 'A').length;
      const teamBCount = remainingPlayers.filter(p => p.team === 'B').length;

      if (teamACount === 0 || teamBCount === 0) {
        const winningTeam = teamACount > 0 ? 'A' : 'B';
        const eliminatedTeam = targetPlayer.team;

        await prisma.teamBattle.update({
          where: { id: battleId },
          data: {
            status: 'completed',
            winningTeam: winningTeam,
          },
        });

        const updatedBattle = await this.getBattleWithDetails(battleId);

        return {
          battle: updatedBattle,
          removedPlayer: {
            userId: targetPlayer.userId,
            username: targetPlayer.username,
            team: targetPlayer.team,
          },
          teamEliminated: true,
          eliminatedTeam: eliminatedTeam,
          winningTeam: winningTeam,
          battleEnded: true,
        };
      }
    }

    const updatedBattle = await this.getBattleWithDetails(battleId);

    return {
      battle: updatedBattle,
      removedPlayer: {
        userId: targetPlayer.userId,
        username: targetPlayer.username,
        team: targetPlayer.team,
      },
      teamEliminated: false,
      battleEnded: false,
    };
  }

  /**
   * Leave team battle - FIXED VERSION
   */
 // In teamBattle.service.js - VERIFY leaveBattle method

async leaveBattle(battleId, userId) {
  console.log("🚪 Leave battle request:", { battleId, userId });

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

  // Find player
  let player = battle.players.find(p => p.userId === userId);
  if (!player) {
    player = battle.players.find(p => String(p.userId) === String(userId));
  }
  
  if (!player) {
    throw new Error('You are not in this battle');
  }

  console.log(`📍 Found player: ${player.username} in Team ${player.team}`);

  // WAITING STATUS
  if (battle.status === 'waiting') {
    if (String(battle.creatorId) === String(userId)) {
      if (battle.players.length > 1) {
        const newCreator = battle.players.find(p => String(p.userId) !== String(userId));
        
        await prisma.teamBattle.update({
          where: { id: battleId },
          data: { creatorId: newCreator.userId },
        });
        
        console.log(`👑 Creator role transferred to ${newCreator.username}`);
     } else {
        const battleCode = battle.battleCode;
        
        await prisma.teamBattleProblem.deleteMany({ where: { battleId } });
        await prisma.teamBattlePlayer.deleteMany({ where: { battleId } });
        await prisma.teamBattle.delete({ where: { id: battleId } });
        
        battleMemory.removeBattle(battleId);
        
        console.log(`🗑️ Battle deleted`);
        return { 
          deleted: true, 
          teamEliminated: false, 
          battleCode: battleCode 
        };
      }
    }

    await prisma.teamBattlePlayer.deleteMany({
      where: { battleId, userId: player.userId },
    });

    console.log(`✅ Player removed from waiting battle`);
    return { 
      deleted: false, 
      teamEliminated: false 
    };
  }

  // ACTIVE STATUS - CRITICAL SECTION
  if (battle.status === 'active') {
    console.log(`⚠️ Player leaving active battle`);

    // Remove player first
    await prisma.teamBattlePlayer.deleteMany({
      where: { battleId, userId: player.userId },
    });

    // Check remaining players
    const remainingPlayers = await prisma.teamBattlePlayer.findMany({
      where: { battleId }
    });

    const teamACount = remainingPlayers.filter(p => p.team === 'A').length;
    const teamBCount = remainingPlayers.filter(p => p.team === 'B').length;

    console.log(`📊 After removal - Team A: ${teamACount}, Team B: ${teamBCount}`);

    // CRITICAL: Check if a team is now empty
    if (teamACount === 0 || teamBCount === 0) {
      const winningTeam = teamACount > 0 ? 'A' : 'B';
      const eliminatedTeam = player.team; // The team the leaving player was on

      console.log(`🏆 TEAM ELIMINATION! Team ${eliminatedTeam} eliminated, Team ${winningTeam} wins`);

      // Update battle status
      await prisma.teamBattle.update({
        where: { id: battleId },
        data: {
          status: 'completed',
          winningTeam: winningTeam,
        },
      });

      // Update memory
      battleMemory.updateBattleStatus(battleId, 'completed', {
        winningTeam: winningTeam
      });

      console.log('✅ Returning team elimination result');
      
      // CRITICAL: Return the correct structure
      return {
        deleted: false,
        teamEliminated: true,        // ← This must be true!
        eliminatedTeam: eliminatedTeam,
        winningTeam: winningTeam,
        battleEnded: true,           // ← This must be true!
        removedPlayer: {
          userId: player.userId,
          username: player.username,
          team: player.team,
        }
      };
    }

    console.log(`✅ Player removed, battle continues`);
    return {
      deleted: false,
      teamEliminated: false,
      battleEnded: false,
    };
  }

  throw new Error('Cannot leave completed battle');
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

    await prisma.teamBattleProblem.update({
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
   * Record individual solve (for total-solves mode)
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
   * Get battle stats with tie-breaking
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

      const teamAUniqueSolves = new Set(teamASolves.map(s => s.problemIndex)).size;
      const teamBUniqueSolves = new Set(teamBSolves.map(s => s.problemIndex)).size;

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
   * Determine winner with tie-breaking
   */
  determineWinnerWithTieBreak(stats) {
    const { teamAScore, teamBScore, lastSolveTime } = stats;

    if (!lastSolveTime) {
      if (teamAScore > teamBScore) return 'A';
      if (teamBScore > teamAScore) return 'B';
      return null;
    }

    if (teamAScore > teamBScore) {
      return 'A';
    } else if (teamBScore > teamAScore) {
      return 'B';
    } else if (teamAScore === teamBScore && teamAScore > 0) {
      if (!lastSolveTime.teamA && !lastSolveTime.teamB) {
        return null;
      }
      
      if (!lastSolveTime.teamB) {
        return 'A';
      }
      
      if (!lastSolveTime.teamA) {
        return 'B';
      }

      const teamATime = new Date(lastSolveTime.teamA).getTime();
      const teamBTime = new Date(lastSolveTime.teamB).getTime();
      return teamATime < teamBTime ? 'A' : 'B';
    }

    return null;
  }
}

module.exports = new TeamBattleService();