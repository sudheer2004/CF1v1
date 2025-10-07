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

// Store draw offers: matchId -> Set of userIds who offered draw
const drawOffers = new Map();

// Log environment config on startup
console.log('\n╔════════════════════════════════════════════╗');
console.log('║     SOCKET HANDLER CONFIGURATION           ║');
console.log('╚════════════════════════════════════════════╝');
console.log('SUBMISSION_POLL_INTERVAL_SECONDS:', process.env.SUBMISSION_POLL_INTERVAL_SECONDS);
console.log('Parsed interval:', parseInt(process.env.SUBMISSION_POLL_INTERVAL_SECONDS) || 10, 'seconds');
console.log('═══════════════════════════════════════════\n');

// Helper function to determine problem tags based on user selections
const determineProblemTags = (tags1, tags2) => {
  const hasTags1 = tags1 && tags1.length > 0;
  const hasTags2 = tags2 && tags2.length > 0;

  if (!hasTags1 && !hasTags2) {
    return [];
  }

  if (hasTags1 && !hasTags2) {
    return tags1;
  }
  if (!hasTags1 && hasTags2) {
    return tags2;
  }

  const commonTags = tags1.filter(tag => tags2.includes(tag));
  
  if (commonTags.length > 0) {
    return commonTags;
  }

  return [];
};

// Helper to stop polling and clean up
const stopPolling = (matchId) => {
  if (activePolls.has(matchId)) {
    console.log('⏹️ Stopping polling for match:', matchId);
    clearInterval(activePolls.get(matchId));
    activePolls.delete(matchId);
  }
  
  // Clean up draw offers
  if (drawOffers.has(matchId)) {
    drawOffers.delete(matchId);
  }
};

const initializeSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('authenticate', async (token) => {
      try {
        const decoded = verifyToken(token);
        if (!decoded) {
          socket.emit('error', { message: 'Invalid token' });
          return;
        }
        socket.userId = decoded.userId;
        
        // Join user's personal room for targeted events
        socket.join(`user-${decoded.userId}`);
        
        socket.emit('authenticated', { userId: decoded.userId });
        
        try {
          const activeMatch = await matchService.getActiveMatchForUser(decoded.userId);
          if (activeMatch && activeMatch.status === 'active') {
            console.log('🔄 Restoring active match for user:', decoded.userId);
            console.log('   Match ID:', activeMatch.id);
            
            const isExpired = matchService.isMatchExpired(activeMatch);
            console.log('   Match expired:', isExpired);
            
            // Check if match is expired
            if (isExpired) {
              console.log('⏰ Restored match has expired, ending immediately...');
              await handleMatchEnd(io, activeMatch, null);
            } else {
              // Resume polling for this match
              console.log('▶️ Resuming polling for active match:', activeMatch.id);
              startSubmissionPolling(io, activeMatch);
              
              const opponentId = activeMatch.player1Id === decoded.userId 
                ? activeMatch.player2Id 
                : activeMatch.player1Id;
              
              const opponent = await userService.findUserById(opponentId);
              const [contestId, index] = activeMatch.problemId.split('-');
              const problemUrl = getCodeforcesUrl(parseInt(contestId), index);
              
              socket.emit('match-found', {
                match: activeMatch,
                problemUrl,
                opponent: {
                  id: opponent.id,
                  username: opponent.username,
                  cfHandle: opponent.cfHandle,
                  rating: opponent.rating,
                },
              });
            }
          }
        } catch (matchError) {
          console.error('Error restoring active match:', matchError);
        }
      } catch (error) {
        socket.emit('error', { message: 'Authentication failed' });
      }
    });

    socket.on('join-matchmaking', async (data) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const { ratingMin, ratingMax, tags, duration } = data;

        const queueEntry = await matchmakingService.addToQueue(
          socket.userId,
          ratingMin,
          ratingMax,
          tags,
          duration
        );

        socket.emit('queue-joined', { queueEntry });

        const match = await matchmakingService.findMatch(queueEntry);

        if (match) {
          await matchmakingService.removeFromQueue(socket.userId);
          await matchmakingService.removeFromQueue(match.userId);

          const overlapMin = Math.max(queueEntry.ratingMin, match.ratingMin);
          const overlapMax = Math.min(queueEntry.ratingMax, match.ratingMax);

          const problemTags = determineProblemTags(queueEntry.tags, match.tags);

          const problem = await codeforcesService.selectRandomProblem(
            overlapMin,
            overlapMax,
            problemTags
          );

          const matchDuration = Math.max(queueEntry.duration, match.duration);

          const createdMatch = await matchService.createMatch(
            socket.userId,
            match.userId,
            problem,
            matchDuration
          );

          const problemUrl = getCodeforcesUrl(problem.contestId, problem.index);

          socket.emit('match-found', {
            match: createdMatch,
            problemUrl,
            opponent: match.user,
          });

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

          // Start polling with logging
          console.log('\n🎮 MATCHMAKING: Match created, starting polling...');
          console.log('   Match ID:', createdMatch.id);
          console.log('   Status:', createdMatch.status);
          startSubmissionPolling(io, createdMatch);
          console.log('✅ Polling started for match:', createdMatch.id, '\n');
        }
      } catch (error) {
        console.error('Join matchmaking error:', error);
        socket.emit('error', { message: error.message || 'Failed to join matchmaking' });
      }
    });

    socket.on('leave-matchmaking', async () => {
      try {
        if (!socket.userId) return;

        await matchmakingService.removeFromQueue(socket.userId);
        socket.emit('queue-left');
      } catch (error) {
        console.error('Leave matchmaking error:', error);
      }
    });

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

    socket.on('join-duel', async (duelCode) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const duel = await duelService.joinDuel(duelCode, socket.userId);

        socket.join(`duel-${duelCode}`);

        io.to(`duel-${duelCode}`).emit('opponent-joined', { duel });

        const problem = await codeforcesService.selectRandomProblem(
          duel.ratingMin,
          duel.ratingMax,
          duel.tags
        );

        await duelService.startDuel(
          duel.id,
          formatProblemId(problem.contestId, problem.index),
          problem.name,
          problem.rating
        );

        const createdMatch = await matchService.createMatch(
          duel.creatorId,
          socket.userId,
          problem,
          duel.duration
        );

        const problemUrl = getCodeforcesUrl(problem.contestId, problem.index);

        io.to(`duel-${duelCode}`).emit('match-start', {
          match: createdMatch,
          problemUrl,
        });

        // Start polling with logging
        console.log('\n⚔️ DUEL: Match created, starting polling...');
        console.log('   Match ID:', createdMatch.id);
        console.log('   Status:', createdMatch.status);
        startSubmissionPolling(io, createdMatch);
        console.log('✅ Polling started for duel match:', createdMatch.id, '\n');
      } catch (error) {
        console.error('Join duel error:', error);
        socket.emit('error', { message: error.message || 'Failed to join duel' });
      }
    });

    // Give Up - Player forfeits the match
    socket.on('give-up', async (data) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const { matchId } = data;
        const match = await matchService.getMatchById(matchId);

        if (!match) {
          socket.emit('error', { message: 'Match not found' });
          return;
        }

        if (match.status !== 'active') {
          socket.emit('error', { message: 'Match is not active' });
          return;
        }

        // Verify user is part of this match
        if (match.player1Id !== socket.userId && match.player2Id !== socket.userId) {
          socket.emit('error', { message: 'You are not part of this match' });
          return;
        }

        console.log('🏳️ Player gave up:', socket.userId, 'Match:', matchId);

        // Determine winner (opponent)
        const winnerId = match.player1Id === socket.userId ? match.player2Id : match.player1Id;

        // Stop polling
        stopPolling(matchId);

        // End match
        await handleMatchEnd(io, match, winnerId);
      } catch (error) {
        console.error('Give up error:', error);
        socket.emit('error', { message: 'Failed to give up' });
      }
    });

    // Offer Draw - Player offers a draw
    socket.on('offer-draw', async (data) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const { matchId } = data;
        const match = await matchService.getMatchById(matchId);

        if (!match) {
          socket.emit('error', { message: 'Match not found' });
          return;
        }

        if (match.status !== 'active') {
          socket.emit('error', { message: 'Match is not active' });
          return;
        }

        // Verify user is part of this match
        if (match.player1Id !== socket.userId && match.player2Id !== socket.userId) {
          socket.emit('error', { message: 'You are not part of this match' });
          return;
        }

        console.log('🤝 Player offered draw:', socket.userId, 'Match:', matchId);

        // Initialize draw offers set for this match if not exists
        if (!drawOffers.has(matchId)) {
          drawOffers.set(matchId, new Set());
        }

        const offersSet = drawOffers.get(matchId);
        offersSet.add(socket.userId);

        // Notify opponent
        const opponentId = match.player1Id === socket.userId ? match.player2Id : match.player1Id;
        io.emit(`draw-offered-${matchId}`, { userId: socket.userId });

        console.log('📡 Draw offer sent to match:', matchId);

        // Check if both players have offered draw
        if (offersSet.has(match.player1Id) && offersSet.has(match.player2Id)) {
          console.log('✅ Both players offered draw, ending match as draw');

          // Stop polling
          stopPolling(matchId);

          // End match as draw
          await handleMatchEnd(io, match, null);
        }
      } catch (error) {
        console.error('Offer draw error:', error);
        socket.emit('error', { message: 'Failed to offer draw' });
      }
    });

    // Accept Draw - Player accepts draw offer
    socket.on('accept-draw', async (data) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const { matchId } = data;
        const match = await matchService.getMatchById(matchId);

        if (!match) {
          socket.emit('error', { message: 'Match not found' });
          return;
        }

        if (match.status !== 'active') {
          socket.emit('error', { message: 'Match is not active' });
          return;
        }

        // Verify user is part of this match
        if (match.player1Id !== socket.userId && match.player2Id !== socket.userId) {
          socket.emit('error', { message: 'You are not part of this match' });
          return;
        }

        const offersSet = drawOffers.get(matchId);
        if (!offersSet) {
          socket.emit('error', { message: 'No draw offer exists' });
          return;
        }

        // Check if opponent has offered draw
        const opponentId = match.player1Id === socket.userId ? match.player2Id : match.player1Id;
        if (!offersSet.has(opponentId)) {
          socket.emit('error', { message: 'Opponent has not offered draw' });
          return;
        }

        console.log('✅ Player accepted draw:', socket.userId, 'Match:', matchId);

        // Stop polling
        stopPolling(matchId);

        // End match as draw
        await handleMatchEnd(io, match, null);
      } catch (error) {
        console.error('Accept draw error:', error);
        socket.emit('error', { message: 'Failed to accept draw' });
      }
    });

    socket.on('disconnect', async () => {
      console.log('Client disconnected:', socket.id);
      
      if (socket.userId) {
        await matchmakingService.removeFromQueue(socket.userId);
      }
    });
  });

  // Cleanup stale queue entries
  setInterval(async () => {
    try {
      await matchmakingService.cleanStaleEntries();
    } catch (error) {
      console.error('Error cleaning stale entries:', error);
    }
  }, 2 * 60 * 1000);

  // CRITICAL: Check for expired matches every 30 seconds
  setInterval(async () => {
    try {
      console.log('🔍 Checking for expired matches...');
      const prisma = require('../config/database.config');
      
      const activeMatches = await prisma.match.findMany({
        where: { status: 'active' },
        include: {
          player1: { select: { id: true, username: true, cfHandle: true, rating: true } },
          player2: { select: { id: true, username: true, cfHandle: true, rating: true } },
        },
      });

      for (const match of activeMatches) {
        if (matchService.isMatchExpired(match)) {
          console.log('⏰ Found expired match:', match.id, '- ending as draw');
          
          // Stop polling if active
          stopPolling(match.id);
          
          // End match as draw
          await handleMatchEnd(io, match, null);
        }
      }
      
      console.log(`✅ Checked ${activeMatches.length} active matches`);
    } catch (error) {
      console.error('Error checking expired matches:', error);
    }
  }, 30000); // Every 30 seconds
};

// Start polling submissions for a match
const startSubmissionPolling = (io, match) => {
  const pollInterval = parseInt(process.env.SUBMISSION_POLL_INTERVAL_SECONDS) || 10;
  
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║      STARTING SUBMISSION POLLING           ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('Match ID:', match.id);
  console.log('Poll Interval:', pollInterval, 'seconds');
  console.log('Match Status:', match.status);
  console.log('Player 1:', match.player1Id, '-', match.player1?.cfHandle);
  console.log('Player 2:', match.player2Id, '-', match.player2?.cfHandle);
  console.log('Problem:', match.problemId);
  console.log('Duration:', match.duration, 'minutes');
  console.log('Start Time:', new Date(match.startTime).toISOString());
  console.log('Active Polls Before:', activePolls.size);

  // Validate match data
  if (!match.player1?.cfHandle || !match.player2?.cfHandle) {
    console.error('❌ ERROR: Missing CF handles!');
    console.error('   Player 1 CF Handle:', match.player1?.cfHandle || 'MISSING');
    console.error('   Player 2 CF Handle:', match.player2?.cfHandle || 'MISSING');
    console.log('═══════════════════════════════════════════\n');
    return;
  }

  // Check if already polling this match
  if (activePolls.has(match.id)) {
    console.log('⚠️ Already polling match', match.id, '- clearing old interval');
    clearInterval(activePolls.get(match.id));
    activePolls.delete(match.id);
  }

  console.log('Creating interval...');
  const intervalId = setInterval(async () => {
    try {
      const currentMatch = await matchService.getMatchById(match.id);

      if (!currentMatch) {
        console.log('❌ Match not found in database');
        stopPolling(match.id);
        return;
      }

      if (currentMatch.status !== 'active') {
        console.log('⏹️ Match no longer active, stopping poll');
        stopPolling(match.id);
        return;
      }

      const isExpired = matchService.isMatchExpired(currentMatch);
      
      if (isExpired) {
        console.log('⏰ Match EXPIRED - ending as draw');
        await handleMatchEnd(io, currentMatch, null);
        stopPolling(match.id);
        return;
      }

      console.log('🔍 Polling submissions for match:', match.id.substring(0, 8));
      const results = await submissionService.pollMatchSubmissions(currentMatch);

      await matchService.updateMatchAttempts(
        currentMatch.id,
        results.player1?.attempts || 0,
        results.player2?.attempts || 0
      );

      if (results.player1?.solved || results.player2?.solved) {
        console.log('🎉 PROBLEM SOLVED!');
        const winnerId = submissionService.determineWinner(
          results.player1,
          results.player2,
          currentMatch.player1Id,
          currentMatch.player2Id
        );
        console.log('Winner:', winnerId);

        await handleMatchEnd(io, currentMatch, winnerId);
        stopPolling(match.id);
        return;
      }

      // Emit updates to clients
      const updateEvent = `match-update-${match.id}`;
      io.emit(updateEvent, {
        player1Attempts: results.player1?.attempts || 0,
        player2Attempts: results.player2?.attempts || 0,
      });
    } catch (error) {
      console.error('POLL ERROR for match', match.id, ':', error.message);
    }
  }, pollInterval * 1000);

  activePolls.set(match.id, intervalId);
  console.log('✅ Interval created successfully');
  console.log('   Active Polls Count:', activePolls.size);
  console.log('═══════════════════════════════════════════\n');
};

// Handle match end
const handleMatchEnd = async (io, match, winnerId) => {
  try {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║         ENDING MATCH                       ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('Match ID:', match.id);
    console.log('Winner ID:', winnerId || 'DRAW');

    // Ensure polling is stopped
    stopPolling(match.id);

    const ratingChanges = ratingService.calculateNewRatings(
      match.player1RatingBefore,
      match.player2RatingBefore,
      winnerId,
      match.player1Id
    );

    console.log('Rating Changes:');
    console.log('   Player 1:', ratingChanges.player1Change);
    console.log('   Player 2:', ratingChanges.player2Change);

    await matchService.completeMatch(
      match.id,
      winnerId,
      ratingChanges.player1Change,
      ratingChanges.player2Change
    );

    const player1Result = winnerId === match.player1Id ? 'win' : winnerId === null ? 'draw' : 'loss';
    const player2Result = winnerId === match.player2Id ? 'win' : winnerId === null ? 'draw' : 'loss';

    await userService.updateUserStats(match.player1Id, ratingChanges.player1Change, player1Result);
    await userService.updateUserStats(match.player2Id, ratingChanges.player2Change, player2Result);

    const matchEndEvent = `match-end-${match.id}`;
    io.emit(matchEndEvent, {
      winnerId,
      player1RatingChange: ratingChanges.player1Change,
      player2RatingChange: ratingChanges.player2Change,
      player1NewRating: ratingChanges.player1NewRating,
      player2NewRating: ratingChanges.player2NewRating,
    });

    console.log('📡 Emitted:', matchEndEvent);
    console.log('✅ Match ended successfully');
    console.log('═══════════════════════════════════════════\n');
  } catch (error) {
    console.error('❌ Handle match end error:', error);
    console.error('Stack:', error.stack);
  }
};

module.exports = initializeSocket;