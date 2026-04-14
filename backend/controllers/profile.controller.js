const userService = require('../services/user.service');
const matchService = require('../services/match.service');

// Get user profile
const getProfile = async (req, res) => {
  try {
    // FIX: Check if userId is 'me' and replace with actual user ID
    let userId = req.params.userId;
    
    if (userId === 'me') {
      userId = req.user.id;
    }

    const user = await userService.findUserById(userId);

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
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
    });
  }
};

// Update CF handle
const updateCfHandle = async (req, res) => {
  try {
    const { cfHandle } = req.body;
    const userId = req.user.id;

    if (!cfHandle) {
      return res.status(400).json({
        success: false,
        message: 'cfHandle is required',
      });
    }

    const user = await userService.updateCfHandle(userId, cfHandle);

    res.status(200).json({
      success: true,
      message: 'Codeforces handle updated successfully',
      data: { user },
    });
  } catch (error) {
    console.error('Update CF handle error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update Codeforces handle',
    });
  }
};

// Update username
const updateUsername = async (req, res) => {
  try {
    const { username } = req.body;
    const userId = req.user.id;

    if (!username || !username.trim()) {
      return res.status(400).json({
        success: false,
        message: 'username is required',
      });
    }

    const trimmedUsername = username.trim();

    if (trimmedUsername.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Username must be at least 3 characters',
      });
    }

    const existingUser = await userService.findUserByUsername(trimmedUsername);
    if (existingUser && existingUser.id !== userId) {
      return res.status(409).json({
        success: false,
        message: 'Username already taken',
      });
    }

    const user = await userService.updateUsername(userId, trimmedUsername);

    res.status(200).json({
      success: true,
      message: 'Username updated successfully',
      data: { user },
    });
  } catch (error) {
    console.error('Update username error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update username',
    });
  }
};

// Get match history
const getMatchHistory = async (req, res) => {
  try {
    // FIX: Check if userId is 'me' and replace with actual user ID
    let userId = req.params.userId;
    
    if (userId === 'me') {
      userId = req.user.id;
    }
    
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const matches = await matchService.getMatchHistory(userId, limit, offset);

    res.status(200).json({
      success: true,
      data: { matches },
    });
  } catch (error) {
    console.error('Get match history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get match history',
    });
  }
};

module.exports = {
  getProfile,
  updateCfHandle,
  updateUsername,
  getMatchHistory,
};
