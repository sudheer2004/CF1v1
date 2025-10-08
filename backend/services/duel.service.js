const prisma = require('../config/database.config');
const { generateDuelCode } = require('../utils/helpers.util');
const { validateMatchSettings, sanitizeMatchSettings } = require('../validators/match.validator');

// Create new duel
const createDuel = async (creatorId, ratingMin, ratingMax, tags, duration) => {
  // Sanitize inputs first
  const sanitized = sanitizeMatchSettings(ratingMin, ratingMax, tags, duration);
  
  // Validate settings
  const validation = validateMatchSettings(
    sanitized.ratingMin,
    sanitized.ratingMax,
    sanitized.tags,
    sanitized.duration
  );

  if (!validation.isValid) {
    const error = new Error('Invalid duel settings');
    error.details = validation.errors;
    throw error;
  }

  // Generate unique duel code
  let duelCode;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    duelCode = generateDuelCode();
    const existing = await prisma.duel.findUnique({
      where: { duelCode },
    });
    if (!existing) isUnique = true;
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique duel code. Please try again.');
  }

  const duel = await prisma.duel.create({
    data: {
      duelCode,
      creatorId,
      ratingMin: sanitized.ratingMin,
      ratingMax: sanitized.ratingMax,
      tags: sanitized.tags,
      duration: sanitized.duration,
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
  // Validate duel code format
  if (!duelCode || typeof duelCode !== 'string') {
    throw new Error('Invalid duel code format');
  }

  // Sanitize duel code (remove whitespace, convert to uppercase)
  const sanitizedCode = duelCode.trim().toUpperCase();

  if (sanitizedCode.length !== 8) {
    throw new Error('Duel code must be 8 characters');
  }

  const duel = await prisma.duel.findUnique({
    where: { duelCode: sanitizedCode },
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
    where: { duelCode: sanitizedCode },
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
  // Validate and sanitize duel code
  if (!duelCode || typeof duelCode !== 'string') {
    throw new Error('Invalid duel code format');
  }

  const sanitizedCode = duelCode.trim().toUpperCase();

  const duel = await prisma.duel.findUnique({
    where: { duelCode: sanitizedCode },
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
  if (!duelId) {
    throw new Error('Duel ID is required');
  }

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