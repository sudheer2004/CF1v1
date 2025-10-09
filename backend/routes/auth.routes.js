const express = require('express');
const passport = require('passport');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authLimiter, checkLimiter } = require('../middlewares/rateLimiter.middleware');

// Public routes with rate limiting
router.post('/signup', authLimiter, authController.signup);
router.post('/login', authLimiter, authController.login);
router.post('/logout', authController.logout);

// Check availability endpoints with separate rate limiting
// FIXED: Changed from /check/username/ to /check-username/
router.get('/check-username/:username', checkLimiter, authController.checkUsername);
router.get('/check-email/:email', checkLimiter, authController.checkEmail);

// Google OAuth routes
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL}?error=auth_failed`,
    session: false,
  }),
  authController.googleCallback
);

// Protected routes (require authentication)
router.get('/me', authMiddleware, authController.getCurrentUser);

module.exports = router;