const matchmakingService = require('../services/matchmaking.service');
const duelService = require('../services/duel.service');
const matchService = require('../services/match.service');
const codeforcesService = require('../services/codeforces.service');
const submissionService = require('../services/submission.service');
const ratingService = require('../services/rating.service');
const userService = require('../services/user.service');
const { verifyToken } = require('../utils/jwt.util');
const { formatProblemId, parseProblemId, getCodeforcesUrl } = require('../utils/helpers.util');

// Store active polling intervals
const activePolls = new Map();

const initializeSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Authenticate socket connection
    socket.on('authenticate', async (token) => {
      try {
        const decoded = verifyToken(token);
        if (!decoded) {
          socket.emit('error', { message: 'Invalid token' });
          return;
        }
        socket.userId = decoded.userId;
        socket.emit('authenticated', { userId: decoded.userId });
      } catch (error) {
        socket.emit('error', { message: 'Authentication failed' });
      }
    });

    // Join matchmaking queue
    socket.on('join-matchmaking', async (data) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const { ratingMin, ratingMax, tags, duration } = data;

        // Add to queue
        const queueEntry = await matchmakingService.addToQueue(
          socket.userId,
          ratingMin,
          ratingMax,
          tags,
          duration
        );

        socket.emit('queue-joined', { queueEntry });

        // Try to find match
        const match = await matchmakingService.findMatch(queueEntry);

        if (match) {
          // Match found! Remove both from queue
          await matchmakingService.removeFromQueue(socket.userId);
          await matchmakingService.removeFromQueue(match.userId);

          // Calculate overlapping rating range and common tags
          const overlapMin = Math.max(queueEntry.ratingMin, match.ratingMin);
          const overlapMax = Math.min(queueEntry.ratingMax, match.ratingMax);
          const commonTags = queueEntry.tags.filter(tag => match.tags.includes(tag));

          // Select random problem
          const problem = await codeforcesService.selectRandomProblem(
            overlapMin,
            overlapMax,
            commonTags
          );

          // Create match in database
          const avgDuration = Math.round((queueEntry.duration + match.duration) / 2);
          const createdMatch = await matchService.createMatch(
            socket.userId,
            match.userId,
            problem,
            avgDuration
          );

          const problemUrl = getCodeforcesUrl(problem.contestId, problem.index);

          // Emit match found to both players
          socket.emit('match-found', {
            match: createdMatch,
            problemUrl,
            opponent: match.user,
          });

          // Find opponent's socket and emit
          const opponentSocket = Array.from(io.sockets.sockets.values()).find(
            s => s.userId === match.userId
          );

          if (opponentSocket) {
            opponentSocket.emit('match-found', {
              match: createdMatch,
              problemUrl,
              opponent: queueEntry.user,
            });
          }

          // Start polling submissions
          startSubmissionPolling(io, createdMatch);
        }
      } catch (error) {
        console.error('Join matchmaking error:', error);
        socket.emit('error', { message: error.message || 'Failed to join matchmaking' });
      }
    });

    // Leave matchmaking queue
    socket.on('leave-matchmaking', async () => {
      try {
        if (!socket.userId) return;

        await matchmakingService.removeFromQueue(socket.userId);
        socket.emit('queue-left');
      } catch (error) {
        console.error('Leave matchmaking error:', error);
      }
    });

    // Create duel
    socket.on('create-duel', async (data) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const { ratingMin, ratingMax, tags, duration } = data;

        const duel = await duelService.createDuel(
          socket.userId,
          ratingMin,
          ratingMax,
          tags,
          duration
        );

        socket.join(`duel-${duel.duelCode}`);
        socket.emit('duel-created', { duel });
      } catch (error) {
        console.error('Create duel error:', error);
        socket.emit('error', { message: 'Failed to create duel' });
      }
    });

    // Join duel
    socket.on('join-duel', async (duelCode) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const duel = await duelService.joinDuel(duelCode, socket.userId);

        socket.join(`duel-${duelCode}`);

        // Notify creator
        io.to(`duel-${duelCode}`).emit('opponent-joined', { duel });

        // Select problem and start match
        const problem = await codeforcesService.selectRandomProblem(
          duel.ratingMin,
          duel.ratingMax,
          duel.tags
        );

        // Update duel with problem
        await duelService.startDuel(
          duel.id,
          formatProblemId(problem.contestId, problem.index),
          problem.name,
          problem.rating
        );

        // Create match
        const createdMatch = await matchService.createMatch(
          duel.creatorId,
          socket.userId,
          problem,
          duel.duration
        );

        const problemUrl = getCodeforcesUrl(problem.contestId, problem.index);

        // Emit match start to both
        io.to(`duel-${duelCode}`).emit('match-start', {
          match: createdMatch,
          problemUrl,
        });

        // Start polling submissions
        startSubmissionPolling(io, createdMatch);
      } catch (error) {
        console.error('Join duel error:', error);
        socket.emit('error', { message: error.message || 'Failed to join duel' });
      }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      console.log('Client disconnected:', socket.id);
      
      if (socket.userId) {
        // Remove from queue if in queue
        await matchmakingService.removeFromQueue(socket.userId);
      }
    });
  });

  // Clean stale queue entries every 2 minutes
  setInterval(async () => {
    try {
      await matchmakingService.cleanStaleEntries();
    } catch (error) {
      console.error('Error cleaning stale entries:', error);
    }
  }, 2 * 60 * 1000);
};

// Start polling submissions for a match
const startSubmissionPolling = (io, match) => {
  const pollInterval = parseInt(process.env.SUBMISSION_POLL_INTERVAL_SECONDS) || 10;

  const intervalId = setInterval(async () => {
    try {
      // Check if match is still active
      const currentMatch = await matchService.getMatchById(match.id);

      if (!currentMatch || currentMatch.status !== 'active') {
        clearInterval(intervalId);
        activePolls.delete(match.id);
        return;
      }

      // Check if time expired
      if (matchService.isMatchExpired(currentMatch)) {
        await handleMatchEnd(io, currentMatch, null);
        clearInterval(intervalId);
        activePolls.delete(match.id);
        return;
      }

      // Poll submissions
      const results = await submissionService.pollMatchSubmissions(currentMatch);

      // Check if anyone solved
      if (results.player1?.solved || results.player2?.solved) {
        const winnerId = submissionService.determineWinner(
          results.player1,
          results.player2,
          currentMatch.player1Id,
          currentMatch.player2Id
        );

        await handleMatchEnd(io, currentMatch, winnerId);
        clearInterval(intervalId);
        activePolls.delete(match.id);
      }

      // Emit attempt counts to both players
      io.emit(`match-update-${match.id}`, {
        player1Attempts: results.player1?.attempts || 0,
        player2Attempts: results.player2?.attempts || 0,
      });
    } catch (error) {
      console.error('Submission polling error:', error);
    }
  }, pollInterval * 1000);

  activePolls.set(match.id, intervalId);
};

// Handle match end
const handleMatchEnd = async (io, match, winnerId) => {
  try {
    // Calculate rating changes
    const ratingChanges = ratingService.calculateNewRatings(
      match.player1RatingBefore,
      match.player2RatingBefore,
      winnerId,
      match.player1Id
    );

    // Update match
    await matchService.completeMatch(
      match.id,
      winnerId,
      ratingChanges.player1Change,
      ratingChanges.player2Change
    );

    // Update user ratings
    const player1Result = winnerId === match.player1Id ? 'win' : winnerId === null ? 'draw' : 'loss';
    const player2Result = winnerId === match.player2Id ? 'win' : winnerId === null ? 'draw' : 'loss';

    await userService.updateUserStats(match.player1Id, ratingChanges.player1Change, player1Result);
    await userService.updateUserStats(match.player2Id, ratingChanges.player2Change, player2Result);

    // Emit match end to both players
    io.emit(`match-end-${match.id}`, {
      winnerId,
      player1RatingChange: ratingChanges.player1Change,
      player2RatingChange: ratingChanges.player2Change,
      player1NewRating: ratingChanges.player1NewRating,
      player2NewRating: ratingChanges.player2NewRating,
    });
  } catch (error) {
    console.error('Handle match end error:', error);
  }
};

module.exports = initializeSocket;