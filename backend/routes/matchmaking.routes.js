const express = require('express');
const matchmakingController = require('../controllers/matchmaking.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.post('/join', matchmakingController.joinQueue);
router.post('/leave', matchmakingController.leaveQueue);
router.get('/status', matchmakingController.getQueueStatus);

module.exports = router;