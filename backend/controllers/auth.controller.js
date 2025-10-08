const userService = require('../services/user.service');
const { generateToken } = require('../utils/jwt.util');

// Signup with email/password
const signup = async (req, res) => {
  try {
    const { email, password, username, cfHandle } = req.body;

    // Validate input
    if (!email || !password || !username) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and username are required',
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

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create user',
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

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token,
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

// Get current user
const getCurrentUser = async (req, res) => {
  try {
    const user = await userService.findUserById(req.user.id);

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

// Google OAuth callback
const googleCallback = async (req, res) => {
  try {
    if (!req.user) {
      console.error('No user data received from Google');
      return res.redirect(`${process.env.FRONTEND_URL}?error=auth_failed`);
    }

    console.log('✅ Google auth successful for user:', req.user.email);

    // Generate token
    const token = generateToken({ userId: req.user.id, email: req.user.email });

    // Redirect to frontend with token in URL
    const redirectUrl = `${process.env.FRONTEND_URL}?token=${token}`;
    res.redirect(redirectUrl);
    
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
    
    console.log('=== USERNAME CHECK START ===');
    console.log('Raw params:', req.params);
    console.log('Username received:', username);
    console.log('Username type:', typeof username);
    console.log('Username length:', username?.length);
    
    // Validate username format
    if (!username || username.length < 3) {
      console.log('Username validation failed - too short');
      return res.json({ exists: false });
    }
    
    // Check if username exists in database
    console.log('Querying database for username:', username);
    const existingUser = await userService.findUserByUsername(username);
    
    console.log('Database query completed');
    console.log('Result:', JSON.stringify(existingUser, null, 2));
    console.log('User exists?:', !!existingUser);
    console.log('=== USERNAME CHECK END ===');
    
    res.json({ exists: !!existingUser });
  } catch (error) {
    console.error('=== ERROR IN USERNAME CHECK ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.json({ exists: false });
  }
};

// Check email availability
const checkEmail = async (req, res) => {
  try {
    const { email } = req.params;
    
    console.log('=== EMAIL CHECK START ===');
    console.log('Raw params:', req.params);
    console.log('Email received:', email);
    console.log('Email type:', typeof email);
    console.log('Email length:', email?.length);
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      console.log('Email validation failed - invalid format');
      return res.json({ exists: false });
    }
    
    // Check if email exists in database
    console.log('Querying database for email:', email);
    const existingUser = await userService.findUserByEmail(email);
    
    console.log('Database query completed');
    console.log('Result:', JSON.stringify(existingUser, null, 2));
    console.log('User exists?:', !!existingUser);
    console.log('=== EMAIL CHECK END ===');
    
    res.json({ exists: !!existingUser });
  } catch (error) {
    console.error('=== ERROR IN EMAIL CHECK ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.json({ exists: false });
  }
};

module.exports = {
  signup,
  login,
  getCurrentUser,
  googleCallback,
  checkUsername,
  checkEmail,
};