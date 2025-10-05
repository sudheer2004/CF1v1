const express = require('express');
const profileController = require('../controllers/profile.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/me', profileController.getProfile);
router.get('/:userId', profileController.getProfile);
router.put('/cfhandle', profileController.updateCfHandle);
router.get('/:userId/matches', profileController.getMatchHistory);

module.exports = router;