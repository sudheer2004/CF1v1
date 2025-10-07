const express = require('express');
const matchController = require('../controllers/match.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/active', matchController.getActiveMatch);
router.get('/history', matchController.getMatchHistory);
router.get('/:matchId', matchController.getMatch);

module.exports = router;