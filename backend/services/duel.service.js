const prisma = require('../config/database.config');
const { generateDuelCode } = require('../utils/helpers.util');

// Create new duel
const createDuel = async (creatorId, ratingMin, ratingMax, tags, duration) => {
  // Generate unique duel code
  let duelCode;
  let isUnique = false;

  while (!isUnique) {
    duelCode = generateDuelCode();
    const existing = await prisma.duel.findUnique({
      where: { duelCode },
    });
    if (!existing) isUnique = true;
  }

  const duel = await prisma.duel.create({
    data: {
      duelCode,
      creatorId,
      ratingMin,
      ratingMax,
      tags,
      duration,
      status: 'waiting',
    },
    include: {
      creator: {
        select: {
          id: true,
          username: true,
          cfHandle: true,
          rating: true,
        },
      },
    },
  });

  return duel;
};

// Join existing duel
const joinDuel = async (duelCode, opponentId) => {
  const duel = await prisma.duel.findUnique({
    where: { duelCode },
    include: {
      creator: {
        select: {
          id: true,
          username: true,
          cfHandle: true,
          rating: true,
        },
      },
    },
  });

  if (!duel) {
    throw new Error('Duel not found');
  }

  if (duel.status !== 'waiting') {
    throw new Error('Duel is not available');
  }

  if (duel.creatorId === opponentId) {
    throw new Error('Cannot join your own duel');
  }

  if (duel.opponentId) {
    throw new Error('Duel already has an opponent');
  }

  const updatedDuel = await prisma.duel.update({
    where: { duelCode },
    data: {
      opponentId,
    },
    include: {
      creator: {
        select: {
          id: true,
          username: true,
          cfHandle: true,
          rating: true,
        },
      },
      opponent: {
        select: {
          id: true,
          username: true,
          cfHandle: true,
          rating: true,
        },
      },
    },
  });

  return updatedDuel;
};

// Get duel by code
const getDuelByCode = async (duelCode) => {
  const duel = await prisma.duel.findUnique({
    where: { duelCode },
    include: {
      creator: {
        select: {
          id: true,
          username: true,
          cfHandle: true,
          rating: true,
        },
      },
      opponent: {
        select: {
          id: true,
          username: true,
          cfHandle: true,
          rating: true,
        },
      },
    },
  });

  return duel;
};

// Start duel (set problem and start time)
const startDuel = async (duelId, problemId, problemName, problemRating) => {
  const duel = await prisma.duel.update({
    where: { id: duelId },
    data: {
      status: 'active',
      problemId,
      problemName,
      problemRating,
      startTime: new Date(),
    },
  });

  return duel;
};

// Cancel duel
const cancelDuel = async (duelId, userId) => {
  const duel = await prisma.duel.findUnique({
    where: { id: duelId },
  });

  if (!duel) {
    throw new Error('Duel not found');
  }

  if (duel.creatorId !== userId) {
    throw new Error('Only creator can cancel the duel');
  }

  if (duel.status !== 'waiting') {
    throw new Error('Cannot cancel active or completed duel');
  }

  await prisma.duel.update({
    where: { id: duelId },
    data: { status: 'cancelled' },
  });

  return { message: 'Duel cancelled successfully' };
};

// Complete duel
const completeDuel = async (duelId, winnerId) => {
  const duel = await prisma.duel.update({
    where: { id: duelId },
    data: {
      status: 'completed',
      winnerId,
      endTime: new Date(),
    },
  });

  return duel;
};

module.exports = {
  createDuel,
  joinDuel,
  getDuelByCode,
  startDuel,
  cancelDuel,
  completeDuel,
};