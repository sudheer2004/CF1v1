const matchService = require('../services/match.service');
const userService = require('../services/user.service');
const { getCodeforcesUrl } = require('../utils/helpers.util');

const isDev = process.env.NODE_ENV === 'development';
const devLog = (...args) => {
  if (isDev) console.log('[DEV]', ...args);
};

exports.getActiveMatch = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get active match for user
    const match = await matchService.getActiveMatchByUserId(userId);
   
    if (!match) {
      return res.json({ match: null });
    }
    
    // SIMPLIFIED: Check expiry using endTime (single source of truth)
    if (!match.endTime) {
      devLog('⚠️ Match missing endTime, using fallback check');
    }
    
    const isExpired = matchService.isMatchExpired(match);
  
    if (isExpired) {
      devLog(`⏱️ Match ${match.id} expired, not returning to client`);
      return res.json({ match: null });
    }
    
    // Get opponent info
    const opponentId = match.player1Id === userId ? match.player2Id : match.player1Id;
    const opponent = await userService.findUserById(opponentId);

    if (!opponent) {
      throw new Error('Opponent not found');
    }
    
    // Get current attempts
    const attempts = {
      player1: match.player1Attempts || 0,
      player2: match.player2Attempts || 0,
    };
    
    // Parse problem ID to get contestId and index
    const [contestId, index] = match.problemId.split('-');
    const problemUrl = getCodeforcesUrl(parseInt(contestId), index);
    
    // CRITICAL: Send endTime as Unix timestamp (milliseconds)
    const endTimeMs = match.endTime ? new Date(match.endTime).getTime() : null;
    
    devLog(`✅ Returning active match with endTime: ${endTimeMs}`);
    
    res.json({
      match: {
        id: match.id,
        player1Id: match.player1Id,
        player2Id: match.player2Id,
        problemId: match.problemId,
        problemName: match.problemName,
        problemRating: match.problemRating,
        duration: match.duration,
        startedAt: match.startTime,
        endTime: endTimeMs, // Send endTime instead of remainingTime!
        status: match.status,
      },
      opponent: {
        id: opponent.id,
        username: opponent.username,
        cfHandle: opponent.cfHandle,
        rating: opponent.rating,
      },
      problemUrl,
      attempts,
    });
  } catch (error) {
    console.error('Get active match error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Failed to get active match', error: error.message });
  }
};

exports.getMatchHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const matches = await matchService.getMatchHistory(userId);
    res.json({ matches });
  } catch (error) {
    console.error('Get match history error:', error);
    res.status(500).json({ message: 'Failed to get match history' });
  }
};

exports.getMatch = async (req, res) => {
  try {
    const { matchId } = req.params;
    const match = await matchService.getMatchById(matchId);
    
    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }
    
    res.json({ match });
  } catch (error) {
    console.error('Get match error:', error);
    res.status(500).json({ message: 'Failed to get match' });
  }
};