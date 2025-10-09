const rateLimit = require('express-rate-limit');

// ===== STRICT RATE LIMITER FOR AUTH ENDPOINTS ONLY =====
// Prevents brute force attacks on login/signup
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count successful requests
  skipFailedRequests: false, // Count failed requests
});

// ===== MODERATE LIMITER FOR CHECK ENDPOINTS =====
// For username/email availability checks during signup
const checkLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 checks per minute (reasonable for typing)
  message: {
    success: false,
    message: 'Too many checks. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  checkLimiter,
};