const prisma = require('../config/database.config');

// Get leaderboard
const getLeaderboard = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        cfHandle: true,
        rating: true,
        wins: true,
        losses: true,
        draws: true,
        totalMatches: true,
      },
      orderBy: {
        rating: 'desc',
      },
      take: limit,
      skip: offset,
    });

    // Add rank to each user
    const leaderboard = users.map((user, index) => ({
      ...user,
      rank: offset + index + 1,
    }));

    res.status(200).json({
      success: true,
      data: { leaderboard },
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get leaderboard',
    });
  }
};

module.exports = {
  getLeaderboard,
};