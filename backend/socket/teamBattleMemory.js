/**
 * In-Memory Team Battle Store
 * Handles instant state updates for active team battles
 */

class TeamBattleMemoryStore {
  constructor() {
    // Map: battleId -> battle object
    this.activeBattles = new Map();
    
    // Map: battleCode -> battleId (for quick lookups)
    this.battleCodeIndex = new Map();
    
    // Map: userId -> battleId (track which battle a user is in)
    this.userBattleIndex = new Map();
  }

  /**
   * Add a battle to memory when created or retrieved from database
   */
  addBattle(battle) {
    if (!battle || !battle.id) {
      console.error('❌ Invalid battle object');
      return;
    }

    // Store battle
    this.activeBattles.set(battle.id, battle);
    
    // Index by battle code
    if (battle.battleCode) {
      this.battleCodeIndex.set(battle.battleCode, battle.id);
    }
    
    // Index all players
    if (battle.players && Array.isArray(battle.players)) {
      battle.players.forEach(player => {
        this.userBattleIndex.set(player.userId, battle.id);
      });
    }

    console.log(`✅ Battle ${battle.battleCode} added to memory (${this.activeBattles.size} active)`);
  }

  /**
   * Get battle by ID
   */
  getBattleById(battleId) {
    return this.activeBattles.get(battleId);
  }

  /**
   * Get battle by code
   */
  getBattleByCode(battleCode) {
    const battleId = this.battleCodeIndex.get(battleCode);
    return battleId ? this.activeBattles.get(battleId) : null;
  }

  /**
   * Get user's current battle
   */
  getUserBattle(userId) {
    const battleId = this.userBattleIndex.get(userId);
    return battleId ? this.activeBattles.get(battleId) : null;
  }

  /**
   * Update player position (INSTANT)
   */
  movePlayer(battleId, userId, newTeam, newPosition) {
    const battle = this.activeBattles.get(battleId);
    
    if (!battle || !battle.players) {
      throw new Error('Battle not found in memory');
    }

    // Check if target slot is occupied
    const targetOccupied = battle.players.find(
      p => p.team === newTeam && p.position === newPosition
    );

    if (targetOccupied) {
      throw new Error('Slot is already occupied');
    }

    // Update player in memory
    const player = battle.players.find(p => p.userId === userId);
    
    if (!player) {
      throw new Error('Player not found in battle');
    }

    player.team = newTeam;
    player.position = newPosition;

    console.log(`✅ [MEMORY] Moved ${player.username} to Team ${newTeam} Position ${newPosition}`);

    return battle;
  }

  /**
   * Add player to battle
   */
  addPlayer(battleId, player) {
    const battle = this.activeBattles.get(battleId);
    
    if (!battle) {
      throw new Error('Battle not found in memory');
    }

    // Check if player already exists
    const existingPlayer = battle.players.find(p => p.userId === player.userId);
    if (existingPlayer) {
      console.warn(`⚠️ Player ${player.username} already in battle`);
      return battle;
    }

    battle.players.push(player);
    this.userBattleIndex.set(player.userId, battleId);

    console.log(`✅ [MEMORY] Added ${player.username} to battle ${battle.battleCode}`);

    return battle;
  }

  /**
   * Remove player from battle
   */
  removePlayer(battleId, userId) {
    const battle = this.activeBattles.get(battleId);
    
    if (!battle) {
      throw new Error('Battle not found in memory');
    }

    const playerIndex = battle.players.findIndex(p => p.userId === userId);
    
    if (playerIndex === -1) {
      throw new Error('Player not found in battle');
    }

    const removedPlayer = battle.players.splice(playerIndex, 1)[0];
    this.userBattleIndex.delete(userId);

    console.log(`✅ [MEMORY] Removed ${removedPlayer.username} from battle ${battle.battleCode}`);

    return battle;
  }

  /**
   * Update battle status (preparing, active, completed)
   */
  updateBattleStatus(battleId, status, extraData = {}) {
    const battle = this.activeBattles.get(battleId);
    
    if (!battle) {
      throw new Error('Battle not found in memory');
    }

    battle.status = status;
    Object.assign(battle, extraData);

    console.log(`✅ [MEMORY] Battle ${battle.battleCode} status: ${status}`);

    return battle;
  }

  /**
   * Update problem solved status
   */
  updateProblemSolved(battleId, problemIndex, team, userId, username) {
    const battle = this.activeBattles.get(battleId);
    
    if (!battle || !battle.problems) {
      throw new Error('Battle not found in memory');
    }

    const problem = battle.problems.find(p => p.problemIndex === problemIndex);
    
    if (!problem) {
      throw new Error('Problem not found');
    }

    if (problem.solvedBy !== null && problem.solvedBy !== undefined) {
      console.log(`⚠️ Problem ${problemIndex} already solved by Team ${problem.solvedBy}`);
      return { updated: false, battle };
    }

    problem.solvedBy = team;
    problem.solvedByUserId = userId;
    problem.solvedByUsername = username;
    problem.solvedAt = new Date();

    console.log(`✅ [MEMORY] Problem ${problemIndex} solved by ${username} (Team ${team})`);

    return { updated: true, battle };
  }

  /**
   * Set battle problems (when battle starts)
   */
  setProblems(battleId, problems) {
    const battle = this.activeBattles.get(battleId);
    
    if (!battle) {
      throw new Error('Battle not found in memory');
    }

    battle.problems = problems;

    console.log(`✅ [MEMORY] Set ${problems.length} problems for battle ${battle.battleCode}`);

    return battle;
  }

  /**
   * Remove battle from memory
   */
  removeBattle(battleId) {
    const battle = this.activeBattles.get(battleId);
    
    if (!battle) {
      return;
    }

    // Clean up indexes
    if (battle.battleCode) {
      this.battleCodeIndex.delete(battle.battleCode);
    }

    if (battle.players) {
      battle.players.forEach(player => {
        this.userBattleIndex.delete(player.userId);
      });
    }

    this.activeBattles.delete(battleId);

    console.log(`✅ [MEMORY] Removed battle ${battle.battleCode} from memory`);
  }

  /**
   * Get all active battles
   */
  getAllBattles() {
    return Array.from(this.activeBattles.values());
  }

  /**
   * Clear all battles (for testing/restart)
   */
  clear() {
    this.activeBattles.clear();
    this.battleCodeIndex.clear();
    this.userBattleIndex.clear();
    console.log('🧹 Memory store cleared');
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      activeBattles: this.activeBattles.size,
      indexedCodes: this.battleCodeIndex.size,
      trackedUsers: this.userBattleIndex.size,
    };
  }
}

// Export singleton instance
module.exports = new TeamBattleMemoryStore();