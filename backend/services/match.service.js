const prisma = require('../config/database.config');
const { formatProblemId } = require('../utils/helpers.util');

// Create new match with endTime calculated at creation
const createMatch = async (player1Id, player2Id, problem, duration) => {
  const player1 = await prisma.user.findUnique({ where: { id: player1Id } });
  const player2 = await prisma.user.findUnique({ where: { id: player2Id } });

  if (!player1 || !player2) {
    throw new Error('One or both players not found');
  }

  if (!player1.cfHandle || !player2.cfHandle) {
    throw new Error('Both players must have Codeforces handles');
  }

  // Calculate endTime when match is created (INDUSTRY STANDARD)
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

  const match = await prisma.match.create({
    data: {
      player1Id,
      player2Id,
      problemId: formatProblemId(problem.contestId, problem.index),
      problemName: problem.name,
      problemRating: problem.rating,
      problemTags: problem.tags,
      duration,
      status: 'active',
      startTime,
      endTime, // Set endTime immediately when match starts!
      player1RatingBefore: player1.rating,
      player2RatingBefore: player2.rating,
      player1Attempts: 0,
      player2Attempts: 0,
    },
    include: {
      player1: {
        select: {
          id: true,
          username: true,
          cfHandle: true,
          rating: true,
        },
      },
      player2: {
        select: {
          id: true,
          username: true,
          cfHandle: true,
          rating: true,
        },
      },
    },
  });

  return match;
};

// Get match by ID
const getMatchById = async (matchId) => {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      player1: {
        select: {
          id: true,
          username: true,
          cfHandle: true,
          rating: true,
        },
      },
      player2: {
        select: {
          id: true,
          username: true,
          cfHandle: true,
          rating: true,
        },
      },
    },
  });

  return match;
};

// Get active match for user
const getActiveMatchForUser = async (userId) => {
  const match = await prisma.match.findFirst({
    where: {
      OR: [
        { player1Id: userId },
        { player2Id: userId },
      ],
      status: 'active',
    },
    include: {
      player1: {
        select: {
          id: true,
          username: true,
          cfHandle: true,
          rating: true,
        },
      },
      player2: {
        select: {
          id: true,
          username: true,
          cfHandle: true,
          rating: true,
        },
      },
    },
    orderBy: {
      startTime: 'desc',
    },
  });

  return match;
};

// Alias for getActiveMatchForUser (used in controller)
const getActiveMatchByUserId = async (userId) => {
  return await getActiveMatchForUser(userId);
};

// Add submission to match
const addSubmission = async (matchId, playerId, submissionData) => {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });

  if (!match) {
    throw new Error('Match not found');
  }

  const isPlayer1 = match.player1Id === playerId;
  const fieldName = isPlayer1 ? 'player1Submissions' : 'player2Submissions';
  const currentSubmissions = match[fieldName];

  const updatedMatch = await prisma.match.update({
    where: { id: matchId },
    data: {
      [fieldName]: [...currentSubmissions, submissionData],
    },
  });

  return updatedMatch;
};

// Complete match - DON'T override endTime (it's already set!)
const completeMatch = async (matchId, winnerId, player1RatingChange, player2RatingChange) => {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });

  if (!match) {
    throw new Error('Match not found');
  }

  const updatedMatch = await prisma.match.update({
    where: { id: matchId },
    data: {
      status: 'completed',
      winnerId,
      // Don't set endTime here - it's already set when match started!
      player1RatingAfter: match.player1RatingBefore + player1RatingChange,
      player1RatingChange,
      player2RatingAfter: match.player2RatingBefore + player2RatingChange,
      player2RatingChange,
    },
  });

  return updatedMatch;
};

// Get match history for user
const getMatchHistory = async (userId, limit = 20, offset = 0) => {
  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { player1Id: userId },
        { player2Id: userId },
      ],
      status: 'completed',
    },
    include: {
      player1: {
        select: {
          id: true,
          username: true,
          rating: true,
        },
      },
      player2: {
        select: {
          id: true,
          username: true,
          rating: true,
        },
      },
    },
    orderBy: {
      endTime: 'desc',
    },
    take: limit,
    skip: offset,
  });

  return matches;
};

// SIMPLIFIED: Check if match expired using endTime (single source of truth)
const isMatchExpired = (match) => {
  if (!match.endTime) {
    // Fallback for old matches without endTime
    const now = Date.now();
    const startTime = new Date(match.startTime).getTime();
    const durationMs = match.duration * 60 * 1000;
    return (now - startTime) >= durationMs;
  }
  
  // New way: just compare current time with endTime
  return new Date() > new Date(match.endTime);
};

// Update match attempts for both players
const updateMatchAttempts = async (matchId, player1Attempts, player2Attempts) => {
  const updatedMatch = await prisma.match.update({
    where: { id: matchId },
    data: {
      player1Attempts,
      player2Attempts,
    },
  });

  return updatedMatch;
};

module.exports = {
  createMatch,
  getMatchById,
  getActiveMatchForUser,
  getActiveMatchByUserId,
  addSubmission,
  completeMatch,
  getMatchHistory,
  isMatchExpired,
  updateMatchAttempts,
};