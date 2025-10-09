const matchmakingService = require("../services/matchmaking.service");
const duelService = require("../services/duel.service");
const matchService = require("../services/match.service");
const codeforcesService = require("../services/codeforces.service");
const submissionService = require("../services/submission.service");
const ratingService = require("../services/rating.service");
const userService = require("../services/user.service");
const messageService = require("../services/message.service");
const { verifyToken } = require("../utils/jwt.util");
const {
  formatProblemId,
  parseProblemId,
  getCodeforcesUrl,
} = require("../utils/helpers.util");
const prisma = require("../config/database.config");

// Store active polling intervals
const activePolls = new Map();

// Store draw offers: matchId -> Set of userIds who offered draw
const drawOffers = new Map();

// Log environment config on startup
console.log("\n╔════════════════════════════════════════════╗");
console.log("║     SOCKET HANDLER CONFIGURATION           ║");
console.log("╚════════════════════════════════════════════╝");
console.log(
  "SUBMISSION_POLL_INTERVAL_SECONDS:",
  process.env.SUBMISSION_POLL_INTERVAL_SECONDS
);
console.log(
  "Parsed interval:",
  parseInt(process.env.SUBMISSION_POLL_INTERVAL_SECONDS) || 10,
  "seconds"
);
console.log("═══════════════════════════════════════════\n");

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

  const commonTags = tags1.filter((tag) => tags2.includes(tag));

  if (commonTags.length > 0) {
    return commonTags;
  }

  return [];
};

// Helper function to determine final minYear from two players
const determineFinalMinYear = (minYear1, minYear2) => {
  // If neither player specified a year, return null
  if (!minYear1 && !minYear2) {
    return null;
  }
  
  // If only one player specified a year, use that
  if (minYear1 && !minYear2) {
    return minYear1;
  }
  if (!minYear1 && minYear2) {
    return minYear2;
  }
  
  // If both specified years, use the more restrictive (higher) value
  return Math.max(minYear1, minYear2);
};

// Helper to stop polling and clean up
const stopPolling = (matchId) => {
  if (activePolls.has(matchId)) {
    console.log("⏹️ Stopping polling for match:", matchId);
    clearInterval(activePolls.get(matchId));
    activePolls.delete(matchId);
  }

  // Clean up draw offers
  if (drawOffers.has(matchId)) {
    drawOffers.delete(matchId);
  }
};

// Helper to check if user has active match
const checkActiveMatch = async (userId) => {
  const activeMatch = await prisma.match.findFirst({
    where: {
      status: "active",
      OR: [{ player1Id: userId }, { player2Id: userId }],
    },
  });
  return activeMatch;
};

// Helper to cancel existing active match
const cancelExistingMatch = async (io, userId) => {
  const existingMatch = await checkActiveMatch(userId);

  if (existingMatch) {
    console.log("⚠️ Cancelling existing active match for user:", userId);
    console.log("   Existing Match ID:", existingMatch.id);

    // Stop polling
    stopPolling(existingMatch.id);

    // Fetch full match details
    const fullMatch = await prisma.match.findUnique({
      where: { id: existingMatch.id },
      include: {
        player1: {
          select: { id: true, username: true, cfHandle: true, rating: true },
        },
        player2: {
          select: { id: true, username: true, cfHandle: true, rating: true },
        },
      },
    });

    // End as draw (no rating change for abandoned match)
    await handleMatchEnd(io, fullMatch, null);

    return true;
  }

  return false;
};

const initializeSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("authenticate", async (token) => {
      try {
        const decoded = verifyToken(token);
        if (!decoded) {
          socket.emit("error", { message: "Invalid token" });
          return;
        }
        socket.userId = decoded.userId;

        // CRITICAL: Join user's personal room for targeted events
        socket.join(`user-${decoded.userId}`);

        console.log("✅ User authenticated:", decoded.userId);
        console.log("   Joined room: user-" + decoded.userId);
        socket.emit("authenticated", { userId: decoded.userId });

        try {
          const activeMatch = await matchService.getActiveMatchForUser(
            decoded.userId
          );
          if (activeMatch && activeMatch.status === "active") {
            console.log("🔄 Restoring active match for user:", decoded.userId);
            console.log("   Match ID:", activeMatch.id);

            const isExpired = matchService.isMatchExpired(activeMatch);
            console.log("   Match expired:", isExpired);

            // Check if match is expired
            if (isExpired) {
              console.log(
                "⏰ Restored match has expired, ending immediately..."
              );
              await handleMatchEnd(io, activeMatch, null);
            } else {
              // Resume polling for this match
              console.log(
                "▶️ Resuming polling for active match:",
                activeMatch.id
              );

              // Fetch full match data with player details
              const fullMatch = await prisma.match.findUnique({
                where: { id: activeMatch.id },
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

              startSubmissionPolling(io, fullMatch);

              const opponentId =
                activeMatch.player1Id === decoded.userId
                  ? activeMatch.player2Id
                  : activeMatch.player1Id;

              const opponent = await userService.findUserById(opponentId);
              const [contestId, index] = activeMatch.problemId.split("-");
              const problemUrl = getCodeforcesUrl(parseInt(contestId), index);

              socket.emit("match-found", {
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
          console.error("Error restoring active match:", matchError);
        }
      } catch (error) {
        console.error("Authentication error:", error);
        socket.emit("error", { message: "Authentication failed" });
      }
    });

    socket.on("join-matchmaking", async (data) => {
      try {
        if (!socket.userId) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }

        // CHECK: User already has active match
        const existingMatch = await checkActiveMatch(socket.userId);
        if (existingMatch) {
          socket.emit("error", {
            message:
              "You already have an active match. Please complete it first.",
          });
          return;
        }

        // UPDATED: Extract minYear from request
        const { ratingMin, ratingMax, tags, duration, minYear } = data;

        // ADD VALIDATION CHECK
        if (ratingMin === undefined || ratingMax === undefined || duration === undefined) {
          socket.emit("error", { message: "Missing required match settings" });
          return;
        }

        // Note: minYear is optional, so we don't validate it here
        // It will be validated in the codeforces service

        const queueEntry = await matchmakingService.addToQueue(
          socket.userId,
          ratingMin,
          ratingMax,
          tags,
          duration
          // Note: minYear is NOT stored in queue - it's just used for problem selection
        );

        socket.emit("queue-joined", { queueEntry });

        const match = await matchmakingService.findMatch(queueEntry);

        if (match) {
          // Double-check both users don't have active matches
          const user1ActiveMatch = await checkActiveMatch(socket.userId);
          const user2ActiveMatch = await checkActiveMatch(match.userId);

          if (user1ActiveMatch || user2ActiveMatch) {
            console.log(
              "⚠️ One or both users have active matches, cancelling matchmaking"
            );
            await matchmakingService.removeFromQueue(socket.userId);
            await matchmakingService.removeFromQueue(match.userId);
            socket.emit("error", {
              message: "Match cancelled - one player has an active match",
            });
            return;
          }

          await matchmakingService.removeFromQueue(socket.userId);
          await matchmakingService.removeFromQueue(match.userId);

          const overlapMin = Math.max(queueEntry.ratingMin, match.ratingMin);
          const overlapMax = Math.min(queueEntry.ratingMax, match.ratingMax);

          const problemTags = determineProblemTags(queueEntry.tags, match.tags);

          // NEW: Determine final minYear (use higher value from both players)
          const finalMinYear = determineFinalMinYear(minYear, match.minYear);
          
          console.log('🗓️ Year filter:', {
            player1MinYear: minYear || 'any',
            player2MinYear: match.minYear || 'any',
            finalMinYear: finalMinYear || 'any'
          });

          // UPDATED: Pass minYear to problem selection
          const problem = await codeforcesService.selectRandomProblem(
            overlapMin,
            overlapMax,
            problemTags,
            finalMinYear // NEW PARAMETER
          );

          const matchDuration = Math.max(queueEntry.duration, match.duration);

          const createdMatch = await matchService.createMatch(
            socket.userId,
            match.userId,
            problem,
            matchDuration
          );

          // Fetch full match with player details for polling
          const fullMatch = await prisma.match.findUnique({
            where: { id: createdMatch.id },
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

          const problemUrl = getCodeforcesUrl(problem.contestId, problem.index);

          console.log("📡 Emitting match-found to both players...");

          // FIXED: Use io.to() for reliable delivery
          io.to(`user-${socket.userId}`).emit("match-found", {
            match: createdMatch,
            problemUrl,
            opponent: match.user,
          });
          console.log("✅ Emitted to player 1 (user-" + socket.userId + ")");

          io.to(`user-${match.userId}`).emit("match-found", {
            match: createdMatch,
            problemUrl,
            opponent: queueEntry.user,
          });
          console.log("✅ Emitted to player 2 (user-" + match.userId + ")");

          // Start polling with full match data
          console.log("\n🎮 MATCHMAKING: Match created, starting polling...");
          console.log("   Match ID:", createdMatch.id);
          console.log("   Player 1 CF:", fullMatch.player1.cfHandle);
          console.log("   Player 2 CF:", fullMatch.player2.cfHandle);
          startSubmissionPolling(io, fullMatch);
          console.log("✅ Polling started for match:", createdMatch.id, "\n");
        }
      } catch (error) {
        console.error("Join matchmaking error:", error);
        
        // IMPROVED ERROR HANDLING
        if (error.details && Array.isArray(error.details)) {
          socket.emit("error", {
            message: error.details.join(', ')
          });
        } else {
          socket.emit("error", {
            message: error.message || "Failed to join matchmaking",
          });
        }
      }
    });

    socket.on("leave-matchmaking", async () => {
      try {
        if (!socket.userId) return;

        await matchmakingService.removeFromQueue(socket.userId);
        socket.emit("queue-left");
      } catch (error) {
        console.error("Leave matchmaking error:", error);
      }
    });

    socket.on("create-duel", async (data) => {
      try {
        if (!socket.userId) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }

        // CHECK: User already has active match
        const existingMatch = await checkActiveMatch(socket.userId);
        if (existingMatch) {
          socket.emit("error", {
            message:
              "You already have an active match. Please complete it first.",
          });
          return;
        }

        // UPDATED: Extract minYear from request
        const { ratingMin, ratingMax, tags, duration, minYear } = data;

        // ADD VALIDATION CHECK
        if (ratingMin === undefined || ratingMax === undefined || duration === undefined) {
          socket.emit("error", { message: "Missing required duel settings" });
          return;
        }

        // UPDATED: Pass minYear to duel creation
        const duel = await duelService.createDuel(
          socket.userId,
          ratingMin,
          ratingMax,
          tags || [],
          duration,
          minYear || null // NEW PARAMETER
        );

        socket.join(`duel-${duel.duelCode}`);

        console.log("✅ Duel created:", duel.duelCode, 'with year filter:', minYear || 'any');

        socket.emit("duel-created", { duel });
      } catch (error) {
        console.error("Create duel error:", error);
        
        if (error.details && Array.isArray(error.details)) {
          socket.emit("error", {
            message: error.details.join(', ')
          });
        } else {
          socket.emit("error", { 
            message: error.message || "Failed to create duel" 
          });
        }
      }
    });

    socket.on("join-duel", async (duelCode) => {
      try {
        if (!socket.userId) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }

        // CHECK: User already has active match
        const existingMatch = await checkActiveMatch(socket.userId);
        if (existingMatch) {
          socket.emit("error", {
            message:
              "You already have an active match. Please complete it first.",
          });
          return;
        }

        const duel = await duelService.joinDuel(duelCode, socket.userId);

        // Also check if duel creator has active match
        const creatorActiveMatch = await checkActiveMatch(duel.creatorId);
        if (creatorActiveMatch) {
          socket.emit("error", {
            message: "Duel creator has an active match. Please wait.",
          });
          return;
        }

        socket.join(`duel-${duelCode}`);

        console.log("✅ Player joined duel:", duelCode);

        // UPDATED: Pass minYear from duel to problem selection
        const problem = await codeforcesService.selectRandomProblem(
          duel.ratingMin,
          duel.ratingMax,
          duel.tags,
          duel.minYear || null // NEW PARAMETER (from duel settings)
        );

        console.log('🗓️ Duel year filter:', duel.minYear || 'any');

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

        // Fetch full match with player details for polling
        const fullMatch = await prisma.match.findUnique({
          where: { id: createdMatch.id },
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

        const problemUrl = getCodeforcesUrl(problem.contestId, problem.index);

        // Get both players' info
        const creator = await userService.findUserById(duel.creatorId);
        const joiner = await userService.findUserById(socket.userId);

        console.log("📡 Emitting match-found to both players...");

        // FIXED: Use io.to() to emit to specific user rooms instead of finding sockets
        io.to(`user-${duel.creatorId}`).emit("match-found", {
          match: createdMatch,
          problemUrl,
          opponent: {
            id: joiner.id,
            username: joiner.username,
            cfHandle: joiner.cfHandle,
            rating: joiner.rating,
          },
        });
        console.log("✅ Emitted to creator (user-" + duel.creatorId + ")");

        io.to(`user-${socket.userId}`).emit("match-found", {
          match: createdMatch,
          problemUrl,
          opponent: {
            id: creator.id,
            username: creator.username,
            cfHandle: creator.cfHandle,
            rating: creator.rating,
          },
        });
        console.log("✅ Emitted to joiner (user-" + socket.userId + ")");

        // Start polling with full match data
        console.log("\n⚔️ DUEL: Match created, starting polling...");
        console.log("   Match ID:", createdMatch.id);
        console.log("   Player 1 CF:", fullMatch.player1.cfHandle);
        console.log("   Player 2 CF:", fullMatch.player2.cfHandle);
        startSubmissionPolling(io, fullMatch);
        console.log(
          "✅ Polling started for duel match:",
          createdMatch.id,
          "\n"
        );
      } catch (error) {
        console.error("Join duel error:", error);
        socket.emit("error", {
          message: error.message || "Failed to join duel",
        });
      }
    });

    // Give Up - Player forfeits the match
    socket.on("give-up", async (data) => {
      try {
        if (!socket.userId) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }

        const { matchId } = data;
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

        if (!match) {
          socket.emit("error", { message: "Match not found" });
          return;
        }

        if (match.status !== "active") {
          socket.emit("error", { message: "Match is not active" });
          return;
        }

        // Verify user is part of this match
        if (
          match.player1Id !== socket.userId &&
          match.player2Id !== socket.userId
        ) {
          socket.emit("error", { message: "You are not part of this match" });
          return;
        }

        console.log("🏳️ Player gave up:", socket.userId, "Match:", matchId);

        // Determine winner (opponent)
        const winnerId =
          match.player1Id === socket.userId ? match.player2Id : match.player1Id;

        // Stop polling
        stopPolling(matchId);

        // End match
        await handleMatchEnd(io, match, winnerId);
      } catch (error) {
        console.error("Give up error:", error);
        socket.emit("error", { message: "Failed to give up" });
      }
    });

    // Offer Draw - Player offers a draw
    socket.on("offer-draw", async (data) => {
      try {
        if (!socket.userId) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }

        const { matchId } = data;
        const match = await matchService.getMatchById(matchId);

        if (!match) {
          socket.emit("error", { message: "Match not found" });
          return;
        }

        if (match.status !== "active") {
          socket.emit("error", { message: "Match is not active" });
          return;
        }

        // Verify user is part of this match
        if (
          match.player1Id !== socket.userId &&
          match.player2Id !== socket.userId
        ) {
          socket.emit("error", { message: "You are not part of this match" });
          return;
        }

        console.log(
          "🤝 Player offered draw:",
          socket.userId,
          "Match:",
          matchId
        );

        // Initialize draw offers set for this match if not exists
        if (!drawOffers.has(matchId)) {
          drawOffers.set(matchId, new Set());
        }

        const offersSet = drawOffers.get(matchId);
        offersSet.add(socket.userId);

        // Notify opponent
        const opponentId =
          match.player1Id === socket.userId ? match.player2Id : match.player1Id;
        io.emit(`draw-offered-${matchId}`, { userId: socket.userId });

        console.log("📡 Draw offer sent to match:", matchId);

        // Check if both players have offered draw
        if (offersSet.has(match.player1Id) && offersSet.has(match.player2Id)) {
          console.log("✅ Both players offered draw, ending match as draw");

          // Stop polling
          stopPolling(matchId);

          // Fetch full match
          const fullMatch = await prisma.match.findUnique({
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

          // End match as draw
          await handleMatchEnd(io, fullMatch, null);
        }
      } catch (error) {
        console.error("Offer draw error:", error);
        socket.emit("error", { message: "Failed to offer draw" });
      }
    });

    // Accept Draw - Player accepts draw offer
    socket.on("accept-draw", async (data) => {
      try {
        if (!socket.userId) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }

        const { matchId } = data;
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

        if (!match) {
          socket.emit("error", { message: "Match not found" });
          return;
        }

        if (match.status !== "active") {
          socket.emit("error", { message: "Match is not active" });
          return;
        }

        // Verify user is part of this match
        if (
          match.player1Id !== socket.userId &&
          match.player2Id !== socket.userId
        ) {
          socket.emit("error", { message: "You are not part of this match" });
          return;
        }

        const offersSet = drawOffers.get(matchId);
        if (!offersSet) {
          socket.emit("error", { message: "No draw offer exists" });
          return;
        }

        // Check if opponent has offered draw
        const opponentId =
          match.player1Id === socket.userId ? match.player2Id : match.player1Id;
        if (!offersSet.has(opponentId)) {
          socket.emit("error", { message: "Opponent has not offered draw" });
          return;
        }

        console.log(
          "✅ Player accepted draw:",
          socket.userId,
          "Match:",
          matchId
        );

        // Stop polling
        stopPolling(matchId);

        // End match as draw
        await handleMatchEnd(io, match, null);
      } catch (error) {
        console.error("Accept draw error:", error);
        socket.emit("error", { message: "Failed to accept draw" });
      }
    });

    // Get match messages
    socket.on("get-match-messages", async (data) => {
      try {
        if (!socket.userId) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }

        const { matchId } = data;

        const match = await prisma.match.findUnique({
          where: { id: matchId },
          select: { player1Id: true, player2Id: true },
        });

        if (!match) {
          socket.emit("error", { message: "Match not found" });
          return;
        }

        if (
          match.player1Id !== socket.userId &&
          match.player2Id !== socket.userId
        ) {
          socket.emit("error", { message: "You are not part of this match" });
          return;
        }

        const messages = await messageService.getMatchMessages(matchId);
        socket.emit("match-messages-loaded", { messages });

        console.log(
          `📨 Loaded ${messages.length} messages for match ${matchId}`
        );
      } catch (error) {
        console.error("Get match messages error:", error);
        socket.emit("error", { message: "Failed to load messages" });
      }
    });

    // Send message
    socket.on("send-message", async (data) => {
      try {
        if (!socket.userId) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }

        const { matchId, content } = data;

        if (!content || content.trim().length === 0) {
          socket.emit("error", { message: "Message cannot be empty" });
          return;
        }

        if (content.length > 500) {
          socket.emit("error", {
            message: "Message too long (max 500 characters)",
          });
          return;
        }

        const match = await prisma.match.findUnique({
          where: { id: matchId },
          include: {
            player1: { select: { id: true, username: true } },
            player2: { select: { id: true, username: true } },
          },
        });

        if (!match) {
          socket.emit("error", { message: "Match not found" });
          return;
        }

        if (
          match.player1Id !== socket.userId &&
          match.player2Id !== socket.userId
        ) {
          socket.emit("error", { message: "You are not part of this match" });
          return;
        }

        if (match.status !== "active") {
          socket.emit("error", { message: "Match is not active" });
          return;
        }

        const senderName =
          match.player1Id === socket.userId
            ? match.player1.username
            : match.player2.username;

        const message = await messageService.createMessage(
          matchId,
          socket.userId,
          senderName,
          content.trim()
        );

        io.emit(`new-message-${matchId}`, { message });

        console.log(`💬 Message sent in match ${matchId} by ${senderName}`);
      } catch (error) {
        console.error("Send message error:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    socket.on("disconnect", async () => {
      console.log("Client disconnected:", socket.id);

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
      console.error("Error cleaning stale entries:", error);
    }
  }, 2 * 60 * 1000);

  // CRITICAL: Check for expired matches every 30 seconds
  setInterval(async () => {
    try {
      console.log("🔍 Checking for expired matches...");

      const activeMatches = await prisma.match.findMany({
        where: { status: "active" },
        include: {
          player1: {
            select: { id: true, username: true, cfHandle: true, rating: true },
          },
          player2: {
            select: { id: true, username: true, cfHandle: true, rating: true },
          },
        },
      });

      for (const match of activeMatches) {
        if (matchService.isMatchExpired(match)) {
          console.log("⏰ Found expired match:", match.id, "- ending as draw");

          // Stop polling if active
          stopPolling(match.id);

          // End match as draw
          await handleMatchEnd(io, match, null);
        }
      }

      console.log(`✅ Checked ${activeMatches.length} active matches`);
    } catch (error) {
      console.error("Error checking expired matches:", error);
    }
  }, 30000); // Every 30 seconds

  // Cleanup old messages daily
  setInterval(async () => {
    try {
      await messageService.cleanupOldMessages();
    } catch (error) {
      console.error('Error during message cleanup:', error);
    }
  }, 24 * 60 * 60 * 1000);
};

// Start polling submissions for a match
const startSubmissionPolling = (io, match) => {
  const pollInterval =
    parseInt(process.env.SUBMISSION_POLL_INTERVAL_SECONDS) || 10;

  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║      STARTING SUBMISSION POLLING           ║");
  console.log("╚════════════════════════════════════════════╝");
  console.log("Match ID:", match.id);
  console.log("Poll Interval:", pollInterval, "seconds");
  console.log("Match Status:", match.status);
  console.log("Player 1:", match.player1Id, "-", match.player1?.cfHandle);
  console.log("Player 2:", match.player2Id, "-", match.player2?.cfHandle);
  console.log("Problem:", match.problemId);
  console.log("Duration:", match.duration, "minutes");
  console.log("Start Time:", new Date(match.startTime).toISOString());
  console.log("Active Polls Before:", activePolls.size);

  // Validate match data
  if (!match.player1?.cfHandle || !match.player2?.cfHandle) {
    console.error("❌ ERROR: Missing CF handles!");
    console.error(
      "   Player 1 CF Handle:",
      match.player1?.cfHandle || "MISSING"
    );
    console.error(
      "   Player 2 CF Handle:",
      match.player2?.cfHandle || "MISSING"
    );
    console.log("═══════════════════════════════════════════\n");
    return;
  }

  // Check if already polling this match
  if (activePolls.has(match.id)) {
    console.log(
      "⚠️ Already polling match",
      match.id,
      "- clearing old interval"
    );
    clearInterval(activePolls.get(match.id));
    activePolls.delete(match.id);
  }

  console.log("Creating interval...");
  const intervalId = setInterval(async () => {
    try {
      console.log("\n🔄 POLLING TICK - Match:", match.id.substring(0, 8));

      const currentMatch = await prisma.match.findUnique({
        where: { id: match.id },
        include: {
          player1: {
            select: { id: true, username: true, cfHandle: true, rating: true },
          },
          player2: {
            select: { id: true, username: true, cfHandle: true, rating: true },
          },
        },
      });

      if (!currentMatch) {
        console.log("❌ Match not found in database");
        stopPolling(match.id);
        return;
      }

      if (currentMatch.status !== "active") {
        console.log(
          "⏹️ Match no longer active (status:",
          currentMatch.status,
          "), stopping poll"
        );
        stopPolling(match.id);
        return;
      }

      const isExpired = matchService.isMatchExpired(currentMatch);

      if (isExpired) {
        console.log("⏰ Match EXPIRED - ending as draw");
        await handleMatchEnd(io, currentMatch, null);
        stopPolling(match.id);
        return;
      }

      console.log("📡 Polling submissions...");
      console.log("   Player 1:", currentMatch.player1.cfHandle);
      console.log("   Player 2:", currentMatch.player2.cfHandle);
      console.log("   Problem:", currentMatch.problemId);

      const results = await submissionService.pollMatchSubmissions(
        currentMatch
      );

      console.log("📊 Poll Results:");
      console.log(
        "   Player 1 - Attempts:",
        results.player1?.attempts || 0,
        "Solved:",
        results.player1?.solved || false
      );
      console.log(
        "   Player 2 - Attempts:",
        results.player2?.attempts || 0,
        "Solved:",
        results.player2?.solved || false
      );

      await matchService.updateMatchAttempts(
        currentMatch.id,
        results.player1?.attempts || 0,
        results.player2?.attempts || 0
      );

      // Emit updates to clients
      const updateEvent = `match-update-${match.id}`;
      io.emit(updateEvent, {
        player1Attempts: results.player1?.attempts || 0,
        player2Attempts: results.player2?.attempts || 0,
      });
      console.log("📤 Emitted update:", updateEvent);

      if (results.player1?.solved || results.player2?.solved) {
        console.log("🎉 PROBLEM SOLVED!");
        const winnerId = submissionService.determineWinner(
          results.player1,
          results.player2,
          currentMatch.player1Id,
          currentMatch.player2Id
        );
        console.log("🏆 Winner:", winnerId);

        await handleMatchEnd(io, currentMatch, winnerId);
        stopPolling(match.id);
        return;
      }
    } catch (error) {
      console.error("❌ POLL ERROR for match", match.id, ":", error.message);
      console.error("Stack:", error.stack);
    }
  }, pollInterval * 1000);

  activePolls.set(match.id, intervalId);
  console.log("✅ Interval created successfully");
  console.log("   Interval ID:", intervalId);
  console.log("   Active Polls Count:", activePolls.size);
  console.log("═══════════════════════════════════════════\n");
};

// Handle match end
const handleMatchEnd = async (io, match, winnerId) => {
  try {
    console.log("\n╔════════════════════════════════════════════╗");
    console.log("║         ENDING MATCH                       ║");
    console.log("╚════════════════════════════════════════════╝");
    console.log("Match ID:", match.id);
    console.log("Winner ID:", winnerId || "DRAW");

    // Ensure polling is stopped
    stopPolling(match.id);

    const ratingChanges = ratingService.calculateNewRatings(
      match.player1RatingBefore,
      match.player2RatingBefore,
      winnerId,
      match.player1Id
    );

    console.log("Rating Changes:");
    console.log("   Player 1:", ratingChanges.player1Change);
    console.log("   Player 2:", ratingChanges.player2Change);

    await matchService.completeMatch(
      match.id,
      winnerId,
      ratingChanges.player1Change,
      ratingChanges.player2Change
    );

    const player1Result =
      winnerId === match.player1Id
        ? "win"
        : winnerId === null
        ? "draw"
        : "loss";
    const player2Result =
      winnerId === match.player2Id
        ? "win"
        : winnerId === null
        ? "draw"
        : "loss";

    await userService.updateUserStats(
      match.player1Id,
      ratingChanges.player1Change,
      player1Result
    );
    await userService.updateUserStats(
      match.player2Id,
      ratingChanges.player2Change,
      player2Result
    );

    const matchEndEvent = `match-end-${match.id}`;
    io.emit(matchEndEvent, {
      winnerId,
      player1RatingChange: ratingChanges.player1Change,
      player2RatingChange: ratingChanges.player2Change,
      player1NewRating: ratingChanges.player1NewRating,
      player2NewRating: ratingChanges.player2NewRating,
    });

    console.log("📡 Emitted:", matchEndEvent);
    await messageService.deleteMatchMessages(match.id);
    console.log("✅ Match ended successfully");
    console.log("═══════════════════════════════════════════\n");
  } catch (error) {
    console.error("❌ Handle match end error:", error);
    console.error("Stack:", error.stack);
  }
};

module.exports = initializeSocket;