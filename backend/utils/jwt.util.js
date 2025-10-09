const jwt = require('jsonwebtoken');

// Validate JWT_SECRET exists and is strong enough
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = process.env.JWT_EXPIRE || process.env.JWT_EXPIRATION || '7d';

if (!JWT_SECRET) {
  throw new Error('❌ CRITICAL: JWT_SECRET is not defined in environment variables');
}

if (JWT_SECRET.length < 32) {
  console.warn('⚠️  WARNING: JWT_SECRET should be at least 32 characters long for better security');
  console.warn('   Generate a strong secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}

/**
 * Generate a JWT token with enhanced security options
 * @param {Object} payload - Data to encode in token (userId, email, etc.)
 * @returns {string} JWT token
 */
const generateToken = (payload) => {
  try {
    return jwt.sign(
      payload, 
      JWT_SECRET, 
      {
        expiresIn: JWT_EXPIRATION,
        issuer: 'cf-duel-app', // Identifies who issued the token
        audience: 'cf-duel-users', // Identifies who the token is for
      }
    );
  } catch (error) {
    console.error('Token generation error:', error);
    throw new Error('Failed to generate authentication token');
  }
};

/**
 * Verify and decode a JWT token with enhanced validation
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded payload or null if invalid/expired
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(
      token, 
      JWT_SECRET,
      {
        issuer: 'cf-duel-app', // Must match the issuer used in generateToken
        audience: 'cf-duel-users', // Must match the audience used in generateToken
      }
    );
    return decoded;
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Token has expired');
      }
      return null;
    }
    
    if (error.name === 'JsonWebTokenError') {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Invalid token:', error.message);
      }
      return null;
    }
    
    if (error.name === 'NotBeforeError') {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Token not yet valid');
      }
      return null;
    }
    
    // Log unexpected errors
    console.error('Unexpected token verification error:', error);
    return null;
  }
};

/**
 * Decode token without verification (use with caution!)
 * Useful for reading token data without validating signature
 * @param {string} token - JWT token to decode
 * @returns {Object|null} Decoded payload or null if invalid format
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Token decode error:', error);
    }
    return null;
  }
};

/**
 * Check if token is expired without throwing errors
 * @param {string} token - JWT token to check
 * @returns {boolean} True if expired, false if valid or if cannot determine
 */
const isTokenExpired = (token) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      return true;
    }
    
    // Check if expiration time (in seconds) is less than current time
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch (error) {
    return true;
  }
};

module.exports = {
  generateToken,
  verifyToken,
  decodeToken,
  isTokenExpired,
};