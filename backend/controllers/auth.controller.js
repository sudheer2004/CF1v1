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

// Google OAuth callback (called by Passport)
const googleCallback = async (req, res) => {
  try {
    const token = generateToken({ userId: req.user.id, email: req.user.email });

    // Send HTML that posts token to opener window and closes popup
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Successful</title>
        </head>
        <body>
          <h2>Authentication successful! Redirecting...</h2>
          <script>
            // Send token to parent window (if opened as popup)
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'GOOGLE_AUTH_SUCCESS', 
                token: '${token}' 
              }, '${process.env.FRONTEND_URL}');
              window.close();
            } else {
              // Regular redirect if not popup
              window.location.href = '${process.env.FRONTEND_URL}/dashboard?token=${token}';
            }
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Google callback error:', error);
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Failed</title>
        </head>
        <body>
          <h2>Authentication failed. Please try again.</h2>
          <script>
            setTimeout(() => {
              window.location.href = '${process.env.FRONTEND_URL}/login';
            }, 2000);
          </script>
        </body>
      </html>
    `);
  }
};

module.exports = {
  signup,
  login,
  getCurrentUser,
  googleCallback,
};