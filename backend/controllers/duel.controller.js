const duelService = require('../services/duel.service');

// Create duel
const createDuel = async (req, res) => {
  try {
    const { ratingMin, ratingMax, tags, duration } = req.body;
    const creatorId = req.user.id;

    // Validate input
    if (!ratingMin || !ratingMax || !tags || !duration) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: ratingMin, ratingMax, tags, duration',
      });
    }

    const duel = await duelService.createDuel(
      creatorId,
      ratingMin,
      ratingMax,
      tags,
      duration
    );

    res.status(201).json({
      success: true,
      message: 'Duel created successfully',
      data: { duel },
    });
  } catch (error) {
    console.error('Create duel error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create duel',
    });
  }
};

// Join duel
const joinDuel = async (req, res) => {
  try {
    const { duelCode } = req.params;
    const opponentId = req.user.id;

    const duel = await duelService.joinDuel(duelCode, opponentId);

    res.status(200).json({
      success: true,
      message: 'Joined duel successfully',
      data: { duel },
    });
  } catch (error) {
    console.error('Join duel error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to join duel',
    });
  }
};

// Get duel details
const getDuel = async (req, res) => {
  try {
    const { duelCode } = req.params;

    const duel = await duelService.getDuelByCode(duelCode);

    if (!duel) {
      return res.status(404).json({
        success: false,
        message: 'Duel not found',
      });
    }

    res.status(200).json({
      success: true,
      data: { duel },
    });
  } catch (error) {
    console.error('Get duel error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get duel',
    });
  }
};

// Cancel duel
const cancelDuel = async (req, res) => {
  try {
    const { duelId } = req.params;
    const userId = req.user.id;

    await duelService.cancelDuel(duelId, userId);

    res.status(200).json({
      success: true,
      message: 'Duel cancelled successfully',
    });
  } catch (error) {
    console.error('Cancel duel error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to cancel duel',
    });
  }
};

module.exports = {
  createDuel,
  joinDuel,
  getDuel,
  cancelDuel,
};