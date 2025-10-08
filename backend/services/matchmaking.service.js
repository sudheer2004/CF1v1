const prisma = require('../config/database.config');
const { validateMatchSettings, sanitizeMatchSettings } = require('../validators/match.validator');

// Add user to matchmaking queue
const addToQueue = async (userId, ratingMin, ratingMax, tags, duration) => {
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
    const error = new Error('Invalid match settings');
    error.details = validation.errors;
    throw error;
  }

  // Remove any existing queue entries for this user
  await prisma.matchmakingQueue.deleteMany({
    where: { userId },
  });

  // Add to queue with sanitized values
  const queueEntry = await prisma.matchmakingQueue.create({
    data: {
      userId,
      ratingMin: sanitized.ratingMin,
      ratingMax: sanitized.ratingMax,
      tags: sanitized.tags,
      duration: sanitized.duration,
      status: 'waiting',
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          cfHandle: true,
          rating: true,
        },
      },
    },
  });

  return queueEntry;
};

// Remove user from queue
const removeFromQueue = async (userId) => {
  await prisma.matchmakingQueue.deleteMany({
    where: { userId },
  });
};

// Find match for a user
const findMatch = async (queueEntry) => {
  const { userId, ratingMin, ratingMax, tags, duration } = queueEntry;

  // Get all waiting users except current user
  const waitingUsers = await prisma.matchmakingQueue.findMany({
    where: {
      userId: { not: userId },
      status: 'waiting',
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          cfHandle: true,
          rating: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc', // FIFO order
    },
  });

  // Find compatible match
  for (const otherUser of waitingUsers) {
    // Check rating overlap (MANDATORY)
    const ratingOverlap = 
      ratingMax >= otherUser.ratingMin &&
      ratingMin <= otherUser.ratingMax;

    // Skip if no rating overlap
    if (!ratingOverlap) {
      continue;
    }

    // Tags are now optional - any combination works
    // No need to check tags for matching

    // Match found!
    return otherUser;
  }

  return null;
};

// Get queue status for user
const getQueueStatus = async (userId) => {
  const queueEntry = await prisma.matchmakingQueue.findFirst({
    where: { 
      userId,
      status: 'waiting',
    },
  });

  if (!queueEntry) {
    return { inQueue: false };
  }

  // Count users in queue
  const queueSize = await prisma.matchmakingQueue.count({
    where: { status: 'waiting' },
  });

  return {
    inQueue: true,
    queueEntry,
    queueSize,
    waitTime: Date.now() - new Date(queueEntry.createdAt).getTime(),
  };
};

// Clean up stale queue entries (older than timeout)
const cleanStaleEntries = async () => {
  const timeoutMinutes = parseInt(process.env.QUEUE_TIMEOUT_MINUTES) || 5;
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const cutoffTime = new Date(Date.now() - timeoutMs);

  const deleted = await prisma.matchmakingQueue.deleteMany({
    where: {
      status: 'waiting',
      createdAt: {
        lt: cutoffTime,
      },
    },
  });

  return deleted.count;
};

module.exports = {
  addToQueue,
  removeFromQueue,
  findMatch,
  getQueueStatus,
  cleanStaleEntries,
};