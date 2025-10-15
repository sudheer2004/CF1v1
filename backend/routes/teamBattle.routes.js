const express = require('express');
const router = express.Router();
const teamBattleController = require('../controllers/teamBattle.controller');
const teamBattleService = require('../services/teamBattle.service'); // ← ADD THIS LINE
const authMiddleware = require('../middlewares/auth.middleware');

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   POST /api/team-battle/create
 * @desc    Create a new team battle room
 * @access  Private
 */
router.post('/create', teamBattleController.createTeamBattle);

/**
 * @route   GET /api/team-battle/active
 * @desc    Get user's active team battle
 * @access  Private
 */
router.get('/active', teamBattleController.getActiveTeamBattle);

/**
 * @route   GET /api/team-battle/:code
 * @desc    Get team battle by code
 * @access  Private
 */
router.get('/:code', teamBattleController.getTeamBattle);

/**
 * @route   POST /api/team-battle/:code/join
 * @desc    Join a team battle
 * @access  Private
 */
router.post('/:code/join', teamBattleController.joinTeamBattle);
router.get('/:battleId/stats', teamBattleController.getTeamBattleStats);
/**
 * @route   DELETE /api/team-battle/:battleId/leave
 * @desc    Leave a team battle (only in waiting status)
 * @access  Private
 */
router.delete('/:battleId/leave', async (req, res, next) => {
  try {
    const { battleId } = req.params;
    const userId = req.user.id;

    console.log('🔍 Leave battle request:');
    console.log('  battleId:', battleId, typeof battleId);
    console.log('  userId:', userId, typeof userId);

    const result = await teamBattleService.leaveBattle(battleId, userId);

    res.json({
      success: true,
      message: result.deleted ? 'Battle deleted' : 'Left battle successfully',
      deleted: result.deleted,
    });
  } catch (error) {
    console.error('❌ Leave battle error:', error);
    next(error);
  }
});

module.exports = router;