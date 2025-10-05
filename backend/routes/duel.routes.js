const express = require('express');
const duelController = require('../controllers/duel.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.post('/create', duelController.createDuel);
router.post('/join/:duelCode', duelController.joinDuel);
router.get('/:duelCode', duelController.getDuel);
router.post('/:duelId/cancel', duelController.cancelDuel);

module.exports = router;