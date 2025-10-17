const prisma = require('../config/database.config');
const battleMemory = require('../socket/teamBattleMemory');

/**
 * Load all active/waiting battles into memory on server startup
 * This ensures that if the server restarts, battles are not lost
 */
async function loadActiveBattlesIntoMemory() {
  try {
    console.log('📥 Loading active battles into memory...');

    const activeBattles = await prisma.teamBattle.findMany({
      where: {
        status: {
          in: ['waiting', 'active']
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

    if (activeBattles.length === 0) {
      console.log('✅ No active battles to load');
      return;
    }

    for (const battle of activeBattles) {
      battleMemory.addBattle(battle);
    }

    console.log(`✅ Loaded ${activeBattles.length} battle(s) into memory:`);
    activeBattles.forEach(b => {
      console.log(`   - ${b.battleCode} (${b.status}, ${b.players.length} players)`);
    });

    // Display memory stats
    const stats = battleMemory.getStats();
    console.log('📊 Memory Store Stats:', stats);

  } catch (error) {
    console.error('❌ Failed to load battles into memory:', error);
    throw error;
  }
}

/**
 * Sync a specific battle from database to memory
 * Useful for manual refresh or error recovery
 */
async function syncBattleFromDatabase(battleId) {
  try {
    const battle = await prisma.teamBattle.findUnique({
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

    if (!battle) {
      console.log(`⚠️ Battle ${battleId} not found in database`);
      return null;
    }

    battleMemory.addBattle(battle);
    console.log(`✅ Synced battle ${battle.battleCode} from database`);

    return battle;
  } catch (error) {
    console.error('❌ Failed to sync battle from database:', error);
    throw error;
  }
}

/**
 * Clean up completed/cancelled battles from memory
 * Run this periodically to free up memory
 */
async function cleanupCompletedBattles() {
  try {
    const allBattles = battleMemory.getAllBattles();
    let removedCount = 0;

    for (const battle of allBattles) {
      if (battle.status === 'completed' || battle.status === 'cancelled') {
        // Check if battle ended more than 5 minutes ago
        const endTime = battle.endTime ? new Date(battle.endTime) : null;
        const now = new Date();
        
        if (endTime && (now - endTime) > 5 * 60 * 1000) {
          battleMemory.removeBattle(battle.id);
          removedCount++;
          console.log(`🧹 Removed completed battle ${battle.battleCode} from memory`);
        }
      }
    }

    if (removedCount > 0) {
      console.log(`✅ Cleaned up ${removedCount} completed battle(s)`);
    }

  } catch (error) {
    console.error('❌ Failed to cleanup completed battles:', error);
  }
}

module.exports = {
  loadActiveBattlesIntoMemory,
  syncBattleFromDatabase,
  cleanupCompletedBattles,
};