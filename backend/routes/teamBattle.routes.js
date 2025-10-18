const express = require('express');
const router = express.Router();
const teamBattleController = require('../controllers/teamBattle.controller');
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

/**
 * @route   GET /api/team-battle/:battleId/stats
 * @desc    Get team battle statistics
 * @access  Private
 */
router.get('/:battleId/stats', teamBattleController.getTeamBattleStats);

/**
 * @route   DELETE /api/team-battle/:id/leave
 * @desc    Leave a team battle
 * @access  Private
 */
router.delete('/:id/leave', teamBattleController.leaveTeamBattle);

module.exports = router;