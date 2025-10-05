const prisma = require('../config/database.config');
const { formatProblemId } = require('../utils/helpers.util');

// Create new match
const createMatch = async (player1Id, player2Id, problem, duration) => {
  const player1 = await prisma.user.findUnique({ where: { id: player1Id } });
  const player2 = await prisma.user.findUnique({ where: { id: player2Id } });

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
      player1RatingBefore: player1.rating,
      player2RatingBefore: player2.rating,
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
  });

  return match;
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

// Complete match
const completeMatch = async (matchId, winnerId, player1RatingChange, player2RatingChange) => {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });

  const updatedMatch = await prisma.match.update({
    where: { id: matchId },
    data: {
      status: 'completed',
      winnerId,
      endTime: new Date(),
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

// Check if match time expired
const isMatchExpired = (match) => {
  const elapsed = Date.now() - new Date(match.startTime).getTime();
  const timeLimit = match.duration * 60 * 1000;
  return elapsed >= timeLimit;
};

module.exports = {
  createMatch,
  getMatchById,
  getActiveMatchForUser,
  addSubmission,
  completeMatch,
  getMatchHistory,
  isMatchExpired,
};