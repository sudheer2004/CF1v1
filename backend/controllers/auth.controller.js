const userService = require('../services/user.service');
const { generateToken } = require('../utils/jwt.util');

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

// Password validation
const validatePassword = (password) => {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  
  if (!hasUpperCase || !hasLowerCase || !hasNumber) {
    return 'Password must contain uppercase, lowercase, and numbers';
  }
  
  return null;
};

// Signup with email/password
const signup = async (req, res) => {
  try {
    const { email, password, username, cfHandle } = req.body;

    // Validate input presence
    if (!email || !password || !username) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and username are required',
      });
    }

    // Validate email format
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    // Validate username format and length
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'Username must be between 3 and 20 characters',
      });
    }

    if (!USERNAME_REGEX.test(username)) {
      return res.status(400).json({
        success: false,
        message: 'Username can only contain letters, numbers, and underscores',
      });
    }

    // Validate password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError,
      });
    }

    // Check if user already exists
    const existingUser = await userService.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Check if username already exists
    const existingUsername = await userService.findUserByUsername(username);
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username already taken',
      });
    }

    // Create user
    const user = await userService.createUser(email, password, username, cfHandle);

    // Generate token
    const token = generateToken({ userId: user.id, email: user.email });

    // Set httpOnly cookie for security
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user,
        token, // Also send in response for frontend flexibility
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' 
        ? 'Failed to create user' 
        : error.message,
    });
  }
};

// Login with email/password
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Validate email format
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    // Find user
    const user = await userService.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check password
    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: 'Please login with Google',
      });
    }

    const isValidPassword = await userService.verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate token
    const token = generateToken({ userId: user.id, email: user.email });

    // Remove password from response
    delete user.password;

    // Set httpOnly cookie for security
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token, // Also send in response for frontend flexibility
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
    });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    // Clear the cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
    });
  }
};

// Get current user
const getCurrentUser = async (req, res) => {
  try {
    const user = await userService.findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user data',
    });
  }
};

// Google OAuth callback - SECURED VERSION
// Google OAuth callback
const googleCallback = async (req, res) => {
  try {
    if (!req.user) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('No user data received from Google');
      }
      return res.redirect(`${process.env.FRONTEND_URL}?error=auth_failed`);
    }

    // Generate token
    const token = generateToken({ userId: req.user.id, email: req.user.email });

    // Redirect with token (frontend will save to localStorage)
    res.redirect(`${process.env.FRONTEND_URL}?token=${token}`);
    
  } catch (error) {
    console.error('Google callback error:', error);
    const errorUrl = `${process.env.FRONTEND_URL}?error=auth_failed`;
    res.redirect(errorUrl);
  }
};
// Check username availability
const checkUsername = async (req, res) => {
  try {
    const { username } = req.params;
    
    // Validate username format
    if (!username || username.length < 3 || username.length > 20) {
      return res.json({ exists: false });
    }

    if (!USERNAME_REGEX.test(username)) {
      return res.json({ exists: false });
    }
    
    // Check if username exists in database
    const existingUser = await userService.findUserByUsername(username);
    
    res.json({ exists: !!existingUser });
  } catch (error) {
    // Don't log sensitive info in production
    if (process.env.NODE_ENV !== 'production') {
      console.error('Username check error:', error);
    }
    res.json({ exists: false });
  }
};

// Check email availability
const checkEmail = async (req, res) => {
  try {
    const { email } = req.params;
    
    // Validate email format
    if (!email || !EMAIL_REGEX.test(email)) {
      return res.json({ exists: false });
    }
    
    // Check if email exists in database
    const existingUser = await userService.findUserByEmail(email);
    
    res.json({ exists: !!existingUser });
  } catch (error) {
    // Don't log sensitive info in production
    if (process.env.NODE_ENV !== 'production') {
      console.error('Email check error:', error);
    }
    res.json({ exists: false });
  }
};

module.exports = {
  signup,
  login,
  logout,
  getCurrentUser,
  googleCallback,
  checkUsername,
  checkEmail,
};