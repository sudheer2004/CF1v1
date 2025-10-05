const matchmakingService = require('../services/matchmaking.service');

// Join matchmaking queue
const joinQueue = async (req, res) => {
  try {
    const { ratingMin, ratingMax, tags, duration } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!ratingMin || !ratingMax || !tags || !duration) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: ratingMin, ratingMax, tags, duration',
      });
    }

    if (ratingMin > ratingMax) {
      return res.status(400).json({
        success: false,
        message: 'ratingMin cannot be greater than ratingMax',
      });
    }

    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'tags must be a non-empty array',
      });
    }

    // Add to queue
    const queueEntry = await matchmakingService.addToQueue(
      userId,
      ratingMin,
      ratingMax,
      tags,
      duration
    );

    res.status(200).json({
      success: true,
      message: 'Added to matchmaking queue',
      data: { queueEntry },
    });
  } catch (error) {
    console.error('Join queue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join queue',
    });
  }
};

// Leave matchmaking queue
const leaveQueue = async (req, res) => {
  try {
    const userId = req.user.id;

    await matchmakingService.removeFromQueue(userId);

    res.status(200).json({
      success: true,
      message: 'Removed from matchmaking queue',
    });
  } catch (error) {
    console.error('Leave queue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave queue',
    });
  }
};

// Get queue status
const getQueueStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const status = await matchmakingService.getQueueStatus(userId);

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Get queue status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get queue status',
    });
  }
};

module.exports = {
  joinQueue,
  leaveQueue,
  getQueueStatus,
};