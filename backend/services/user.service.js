const prisma = require('../config/database.config');
const { hashPassword, comparePassword } = require('../utils/bcrypt.util');

// Create new user (email/password signup)
const createUser = async (email, password, username, cfHandle) => {
  const hashedPassword = await hashPassword(password);
  
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      username,
      cfHandle,
    },
    select: {
      id: true,
      email: true,
      username: true,
      cfHandle: true,
      rating: true,
      createdAt: true,
    },
  });

  return user;
};

// Create or find Google OAuth user
const findOrCreateGoogleUser = async (googleId, email, username) => {
  let user = await prisma.user.findUnique({
    where: { googleId },
  });

  if (!user) {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Link Google account to existing user
      user = await prisma.user.update({
        where: { email },
        data: { googleId },
      });
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          googleId,
          email,
          username: username || email.split('@')[0],
        },
      });
    }
  }

  return user;
};

// Find user by email
const findUserByEmail = async (email) => {
  return prisma.user.findUnique({
    where: { email },
  });
};

// Find user by ID
const findUserById = async (userId) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      cfHandle: true,
      rating: true,
      wins: true,
      losses: true,
      draws: true,
      totalMatches: true,
      createdAt: true,
    },
  });
};

// Verify password
const verifyPassword = async (plainPassword, hashedPassword) => {
  return comparePassword(plainPassword, hashedPassword);
};

// Update user CF handle
const updateCfHandle = async (userId, cfHandle) => {
  return prisma.user.update({
    where: { id: userId },
    data: { cfHandle },
    select: {
      id: true,
      username: true,
      cfHandle: true,
    },
  });
};

// Update user rating and stats
const updateUserStats = async (userId, ratingChange, result) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  const newRating = Math.max(0, user.rating + ratingChange); // Floor at 0

  const updateData = {
    rating: newRating,
    totalMatches: user.totalMatches + 1,
  };

  if (result === 'win') {
    updateData.wins = user.wins + 1;
  } else if (result === 'loss') {
    updateData.losses = user.losses + 1;
  } else if (result === 'draw') {
    updateData.draws = user.draws + 1;
  }

  return prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
};

module.exports = {
  createUser,
  findOrCreateGoogleUser,
  findUserByEmail,
  findUserById,
  verifyPassword,
  updateCfHandle,
  updateUserStats,
};