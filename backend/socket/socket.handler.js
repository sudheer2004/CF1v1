const matchmakingService = require("../services/matchmaking.service");
const duelService = require("../services/duel.service");
const matchService = require("../services/match.service");
const codeforcesService = require("../services/codeforces.service");
const submissionService = require("../services/submission.service");
const ratingService = require("../services/rating.service");
const userService = require("../services/user.service");
const messageService = require("../services/message.service");
const teamBattleService = require("../services/teamBattle.service");
const teamBattlePollingService = require("../services/teamBattlePolling.service");
const {
  initializeTeamBattleSocket,
  startExpiredBattlesCheck,
} = require("./teamBattle.socket");
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

// Online users tracking
const onlineUsers = new Set();

// Rate limiter for global messages - userId -> [timestamps]
const messageRateLimiter = new Map();

// Helper function to determine problem tags based on user selections
const determineProblemTags = (tags1, tags2) => {
  const hasTags1 = tags1 && tags1.length > 0;
  const hasTags2 = tags2 && tags2.length > 0;

  if (!hasTags1 && !hasTags2) return [];
  if (hasTags1 && !hasTags2) return tags1;
  if (!hasTags1 && hasTags2) return tags2;

  const commonTags = tags1.filter((tag) => tags2.includes(tag));
  return commonTags.length > 0 ? commonTags : [];
};

// Helper function to determine final minYear from two players
const determineFinalMinYear = (minYear1, minYear2) => {
  if (!minYear1 && !minYear2) return null;
  if (minYear1 && !minYear2) return minYear1;
  if (!minYear1 && minYear2) return minYear2;
  return Math.max(minYear1, minYear2);
};

// Helper to stop polling and clean up
const stopPolling = (matchId) => {
  if (activePolls.has(matchId)) {
    clearInterval(activePolls.get(matchId));
    activePolls.delete(matchId);
  }
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
    stopPolling(existingMatch.id);

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

    await handleMatchEnd(io, fullMatch, null);
    return true;
  }

  return false;
};

// Rate limiter helper
const checkRateLimit = (userId) => {
  const limit = parseInt(process.env.GLOBAL_MESSAGE_RATE_LIMIT || "15");
  const now = Date.now();
  const userMessages = messageRateLimiter.get(userId) || [];

  const recentMessages = userMessages.filter(
    (timestamp) => now - timestamp < 60000,
  );

  if (recentMessages.length >= limit) {
    const oldestTimestamp = Math.min(...recentMessages);
    const secondsUntilReset = Math.ceil(
      (60000 - (now - oldestTimestamp)) / 1000,
    );
    return { allowed: false, secondsUntilReset };
  }

  recentMessages.push(now);
  messageRateLimiter.set(userId, recentMessages);
  return { allowed: true };
};

// Cleanup rate limiter periodically
const cleanupRateLimiter = () => {
  const now = Date.now();
  for (const [userId, timestamps] of messageRateLimiter.entries()) {
    const recentMessages = timestamps.filter(
      (timestamp) => now - timestamp < 60000,
    );
    if (recentMessages.length === 0) {
      messageRateLimiter.delete(userId);
    } else {
      messageRateLimiter.set(userId, recentMessages);
    }
  }
};

const initializeSocket = (io) => {
  startExpiredBattlesCheck(io);

  io.on("connection", (socket) => {
    console.log("🔌 New socket connection:", socket.id);

    // ==================== AUTHENTICATION ====================

    socket.on("authenticate", async (token) => {
      try {
        const decoded = verifyToken(token);

        if (!decoded) {
          socket.emit("error", { message: "Invalid token" });
          return;
        }

        socket.userId = decoded.userId;
        socket.join(`user-${decoded.userId}`);

        // Track online users
        onlineUsers.add(decoded.userId);
        io.emit("online-users-count", onlineUsers.size);
        console.log(
          `👤 User ${decoded.userId} online. Total: ${onlineUsers.size}`,
        );

        socket.emit("authenticated", { userId: decoded.userId });

        try {
          const activeMatch = await matchService.getActiveMatchForUser(
            decoded.userId,
          );
          if (activeMatch && activeMatch.status === "active") {
            const isExpired = matchService.isMatchExpired(activeMatch);

            if (isExpired) {
              await handleMatchEnd(io, activeMatch, null);
            } else {
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

    // ==================== GLOBAL CHAT EVENTS ====================

    // Send new global message with rate limiting
    socket.on("broadcast", async (content) => {
      try {
        if (!socket.userId) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }

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

        const rateLimitCheck = checkRateLimit(socket.userId);
        if (!rateLimitCheck.allowed) {
          socket.emit("rate-limit-exceeded", {
            message: `Too many messages. Please wait ${rateLimitCheck.secondsUntilReset} seconds.`,
            secondsUntilReset: rateLimitCheck.secondsUntilReset,
          });
          console.log(`⚠️ Rate limit exceeded for user ${socket.userId}`);
          return;
        }

        const message = await messageService.createGlobalMessage(
          socket.userId,
          content.trim(),
        );

        io.emit("global-message", { message });
        console.log(`📤 Global message sent by ${message.senderName}`);
      } catch (error) {
        console.error("❌ Broadcast error:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // FIX: Relay edit to all clients — REST already saved to DB, no second DB call
    socket.on("broadcast-message-edit", ({ messageId, content }) => {
      if (!socket.userId) {
        socket.emit("error", { message: "Not authenticated" });
        return;
      }

      if (!messageId || !content?.trim()) {
        socket.emit("error", { message: "messageId and content are required" });
        return;
      }

      io.emit("global-message-edited", {
        message: { id: messageId, content: content.trim(), isEdited: true },
      });

      console.log(
        `✏️ Message ${messageId} edit broadcast by user ${socket.userId}`,
      );
    });

    // FIX: Relay delete to all clients — REST already deleted from DB, no second DB call
    socket.on("broadcast-message-delete", ({ messageId }) => {
      if (!socket.userId) {
        socket.emit("error", { message: "Not authenticated" });
        return;
      }

      if (!messageId) {
        socket.emit("error", { message: "messageId is required" });
        return;
      }

      io.emit("global-message-deleted", {
        message: { id: messageId, isDeleted: true },
      });

      console.log(
        `🗑️ Message ${messageId} delete broadcast by user ${socket.userId}`,
      );
    });

    // ==================== MATCHMAKING EVENTS ====================

    socket.on("join-matchmaking", async (data) => {
      try {
        if (!socket.userId) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }

        const existingMatch = await checkActiveMatch(socket.userId);
        if (existingMatch) {
          socket.emit("error", {
            message:
              "You already have an active match. Please complete it first.",
          });
          return;
        }

        const { ratingMin, ratingMax, tags, duration, minYear } = data;

        if (
          ratingMin === undefined ||
          ratingMax === undefined ||
          duration === undefined
        ) {
          socket.emit("error", { message: "Missing required match settings" });
          return;
        }

        const queueEntry = await matchmakingService.addToQueue(
          socket.userId,
          ratingMin,
          ratingMax,
          tags,
          duration,
        );

        socket.emit("queue-joined", { queueEntry });

        const match = await matchmakingService.findMatch(queueEntry);

        if (match) {
          const user1ActiveMatch = await checkActiveMatch(socket.userId);
          const user2ActiveMatch = await checkActiveMatch(match.userId);

          if (user1ActiveMatch || user2ActiveMatch) {
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
          const finalMinYear = determineFinalMinYear(minYear, match.minYear);

          io.to(`user-${socket.userId}`).emit("match-preparing", {
            message: "Opponent found! Selecting problem...",
          });
          io.to(`user-${match.userId}`).emit("match-preparing", {
            message: "Opponent found! Selecting problem...",
          });

          try {
            const player1 = await userService.findUserById(socket.userId);
            const player2 = await userService.findUserById(match.userId);

            if (!player1?.cfHandle || !player2?.cfHandle) {
              throw new Error("Missing Codeforces handles");
            }

            const problem =
              await codeforcesService.selectRandomUnsolvedProblem(
                overlapMin,
                overlapMax,
                problemTags,
                finalMinYear,
                player1.cfHandle,
                player2.cfHandle,
              );

            const matchDuration = Math.max(
              queueEntry.duration,
              match.duration,
            );

            const createdMatch = await matchService.createMatch(
              socket.userId,
              match.userId,
              problem,
              matchDuration,
            );

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

            const problemUrl = getCodeforcesUrl(
              problem.contestId,
              problem.index,
            );

            io.to(`user-${socket.userId}`).emit("match-found", {
              match: createdMatch,
              problemUrl,
              opponent: match.user,
            });

            io.to(`user-${match.userId}`).emit("match-found", {
              match: createdMatch,
              problemUrl,
              opponent: queueEntry.user,
            });

            startSubmissionPolling(io, fullMatch);
          } catch (problemError) {
            console.error("Problem selection failed:", problemError);

            io.to(`user-${socket.userId}`).emit("error", {
              message: "Failed to find suitable problem. Please try again.",
            });
            io.to(`user-${match.userId}`).emit("error", {
              message: "Failed to find suitable problem. Please try again.",
            });
          }
        }
      } catch (error) {
        console.error("Join matchmaking error:", error);

        if (error.details && Array.isArray(error.details)) {
          socket.emit("error", { message: error.details.join(", ") });
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

    // ==================== DUEL EVENTS ====================

    socket.on("create-duel", async (data) => {
      try {
        if (!socket.userId) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }

        const existingMatch = await checkActiveMatch(socket.userId);
        if (existingMatch) {
          socket.emit("error", {
            message:
              "You already have an active match. Please complete it first.",
          });
          return;
        }

        const { ratingMin, ratingMax, tags, duration, minYear } = data;

        if (
          ratingMin === undefined ||
          ratingMax === undefined ||
          duration === undefined
        ) {
          socket.emit("error", { message: "Missing required duel settings" });
          return;
        }

        const duel = await duelService.createDuel(
          socket.userId,
          ratingMin,
          ratingMax,
          tags || [],
          duration,
          minYear || null,
        );

        socket.join(`duel-${duel.duelCode}`);
        socket.emit("duel-created", { duel });
      } catch (error) {
        console.error("Create duel error:", error);

        if (error.details && Array.isArray(error.details)) {
          socket.emit("error", { message: error.details.join(", ") });
        } else {
          socket.emit("error", {
            message: error.message || "Failed to create duel",
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

        const existingMatch = await checkActiveMatch(socket.userId);
        if (existingMatch) {
          socket.emit("error", {
            message:
              "You already have an active match. Please complete it first.",
          });
          return;
        }

        const duel = await duelService.joinDuel(duelCode, socket.userId);

        const creatorActiveMatch = await checkActiveMatch(duel.creatorId);
        if (creatorActiveMatch) {
          socket.emit("error", {
            message: "Duel creator has an active match. Please wait.",
          });
          return;
        }

        socket.join(`duel-${duelCode}`);

        io.to(`user-${socket.userId}`).emit("match-preparing", {
          message: "Selecting problem...",
        });
        io.to(`user-${duel.creatorId}`).emit("match-preparing", {
          message: "Opponent joined! Selecting problem...",
        });

        try {
          const creator = await userService.findUserById(duel.creatorId);
          const joiner = await userService.findUserById(socket.userId);

          if (!creator?.cfHandle || !joiner?.cfHandle) {
            throw new Error("Missing Codeforces handles");
          }

          const problem = await codeforcesService.selectRandomUnsolvedProblem(
            duel.ratingMin,
            duel.ratingMax,
            duel.tags,
            duel.minYear || null,
            creator.cfHandle,
            joiner.cfHandle,
          );

          await duelService.startDuel(
            duel.id,
            formatProblemId(problem.contestId, problem.index),
            problem.name,
            problem.rating,
          );

          const createdMatch = await matchService.createMatch(
            duel.creatorId,
            socket.userId,
            problem,
            duel.duration,
          );

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

          startSubmissionPolling(io, fullMatch);
        } catch (problemError) {
          console.error("Problem selection failed:", problemError);

          io.to(`user-${socket.userId}`).emit("error", {
            message: "Failed to find suitable problem. Please try again.",
          });
          io.to(`user-${duel.creatorId}`).emit("error", {
            message: "Failed to find suitable problem. Please try again.",
          });
        }
      } catch (error) {
        console.error("Join duel error:", error);
        socket.emit("error", {
          message: error.message || "Failed to join duel",
        });
      }
    });

    // ==================== MATCH ACTION EVENTS ====================

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

        if (
          match.player1Id !== socket.userId &&
          match.player2Id !== socket.userId
        ) {
          socket.emit("error", { message: "You are not part of this match" });
          return;
        }

        const winnerId =
          match.player1Id === socket.userId ? match.player2Id : match.player1Id;

        stopPolling(matchId);
        await handleMatchEnd(io, match, winnerId);
      } catch (error) {
        console.error("Give up error:", error);
        socket.emit("error", { message: "Failed to give up" });
      }
    });

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

        if (
          match.player1Id !== socket.userId &&
          match.player2Id !== socket.userId
        ) {
          socket.emit("error", { message: "You are not part of this match" });
          return;
        }

        if (!drawOffers.has(matchId)) {
          drawOffers.set(matchId, new Set());
        }

        const offersSet = drawOffers.get(matchId);
        offersSet.add(socket.userId);

        const opponentId =
          match.player1Id === socket.userId ? match.player2Id : match.player1Id;

        io.to(`user-${opponentId}`).emit(`draw-offered-${matchId}`, {
          offeredBy: socket.userId,
        });

        if (offersSet.has(match.player1Id) && offersSet.has(match.player2Id)) {
          stopPolling(matchId);

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

          await handleMatchEnd(io, fullMatch, null);
        }
      } catch (error) {
        console.error("Offer draw error:", error);
        socket.emit("error", { message: "Failed to offer draw" });
      }
    });

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

        const opponentId =
          match.player1Id === socket.userId ? match.player2Id : match.player1Id;

        if (!offersSet.has(opponentId)) {
          socket.emit("error", { message: "Opponent has not offered draw" });
          return;
        }

        stopPolling(matchId);
        await handleMatchEnd(io, match, null);
      } catch (error) {
        console.error("Accept draw error:", error);
        socket.emit("error", { message: "Failed to accept draw" });
      }
    });

    // FIX: reject-draw was completely missing — added handler
    socket.on("reject-draw", async (data) => {
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

        if (
          match.player1Id !== socket.userId &&
          match.player2Id !== socket.userId
        ) {
          socket.emit("error", { message: "You are not part of this match" });
          return;
        }

        // Remove the opponent's pending draw offer
        const offersSet = drawOffers.get(matchId);
        if (offersSet) {
          const opponentId =
            match.player1Id === socket.userId
              ? match.player2Id
              : match.player1Id;
          offersSet.delete(opponentId);
        }

        // Notify the opponent their draw was rejected
        const opponentId =
          match.player1Id === socket.userId ? match.player2Id : match.player1Id;

        io.to(`user-${opponentId}`).emit(`draw-rejected-${matchId}`, {
          rejectedBy: socket.userId,
        });

        console.log(
          `❌ Draw rejected for match ${matchId} by user ${socket.userId}`,
        );
      } catch (error) {
        console.error("Reject draw error:", error);
        socket.emit("error", { message: "Failed to reject draw" });
      }
    });

    // ==================== MATCH CHAT EVENTS ====================

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
      } catch (error) {
        console.error("Get match messages error:", error);
        socket.emit("error", { message: "Failed to load messages" });
      }
    });

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
          content.trim(),
        );

        io.emit(`new-message-${matchId}`, { message });
      } catch (error) {
        console.error("Send message error:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // ==================== TEAM BATTLE ====================

    initializeTeamBattleSocket(io, socket);

    // ==================== DISCONNECT ====================

    socket.on("disconnect", async () => {
      if (socket.userId) {
        await matchmakingService.removeFromQueue(socket.userId);

        onlineUsers.delete(socket.userId);
        io.emit("online-users-count", onlineUsers.size);
        console.log(
          `👋 User ${socket.userId} offline. Total: ${onlineUsers.size}`,
        );
      }
    });
  });

  // ==================== INTERVALS ====================

  // Cleanup stale queue entries every 2 minutes
  setInterval(async () => {
    try {
      await matchmakingService.cleanStaleEntries();
    } catch (error) {
      console.error("Error cleaning stale entries:", error);
    }
  }, 2 * 60 * 1000);

  // Check for expired matches every 30 seconds
  setInterval(async () => {
    try {
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
          stopPolling(match.id);
          await handleMatchEnd(io, match, null);
        }
      }
    } catch (error) {
      console.error("Error checking expired matches:", error);
    }
  }, 30000);

  // Cleanup old match messages daily
  setInterval(async () => {
    try {
      await messageService.cleanupOldMessages();
    } catch (error) {
      console.error("Error during match message cleanup:", error);
    }
  }, 24 * 60 * 60 * 1000);

  // Cleanup old global messages daily
  setInterval(async () => {
    try {
      await messageService.cleanupOldGlobalMessages();
    } catch (error) {
      console.error("Error during global message cleanup:", error);
    }
  }, 24 * 60 * 60 * 1000);

  // Cleanup rate limiter every 2 minutes
  setInterval(() => {
    try {
      cleanupRateLimiter();
    } catch (error) {
      console.error("Error during rate limiter cleanup:", error);
    }
  }, 2 * 60 * 1000);
};

// ==================== SUBMISSION POLLING ====================

const startSubmissionPolling = (io, match) => {
  const pollInterval =
    parseInt(process.env.SUBMISSION_POLL_INTERVAL_SECONDS) || 10;

  if (!match.player1?.cfHandle || !match.player2?.cfHandle) {
    console.error("❌ ERROR: Missing CF handles!");
    console.error(
      "   Player 1 CF Handle:",
      match.player1?.cfHandle || "MISSING",
    );
    console.error(
      "   Player 2 CF Handle:",
      match.player2?.cfHandle || "MISSING",
    );
    return;
  }

  if (activePolls.has(match.id)) {
    clearInterval(activePolls.get(match.id));
    activePolls.delete(match.id);
  }

  const intervalId = setInterval(async () => {
    try {
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
        stopPolling(match.id);
        return;
      }

      if (currentMatch.status !== "active") {
        stopPolling(match.id);
        return;
      }

      if (matchService.isMatchExpired(currentMatch)) {
        await handleMatchEnd(io, currentMatch, null);
        stopPolling(match.id);
        return;
      }

      const results =
        await submissionService.pollMatchSubmissions(currentMatch);

      await matchService.updateMatchAttempts(
        currentMatch.id,
        results.player1?.attempts || 0,
        results.player2?.attempts || 0,
      );

      io.emit(`match-update-${match.id}`, {
        player1Attempts: results.player1?.attempts || 0,
        player2Attempts: results.player2?.attempts || 0,
      });

      if (results.player1?.solved || results.player2?.solved) {
        const winnerId = submissionService.determineWinner(
          results.player1,
          results.player2,
          currentMatch.player1Id,
          currentMatch.player2Id,
        );

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
};

// ==================== MATCH END ====================

const handleMatchEnd = async (io, match, winnerId) => {
  try {
    stopPolling(match.id);

    const ratingChanges = ratingService.calculateNewRatings(
      match.player1RatingBefore,
      match.player2RatingBefore,
      winnerId,
      match.player1Id,
    );

    await matchService.completeMatch(
      match.id,
      winnerId,
      ratingChanges.player1Change,
      ratingChanges.player2Change,
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
      player1Result,
    );
    await userService.updateUserStats(
      match.player2Id,
      ratingChanges.player2Change,
      player2Result,
    );

    io.emit(`match-end-${match.id}`, {
      winnerId,
      player1RatingChange: ratingChanges.player1Change,
      player2RatingChange: ratingChanges.player2Change,
      player1NewRating: ratingChanges.player1NewRating,
      player2NewRating: ratingChanges.player2NewRating,
    });

    await messageService.deleteMatchMessages(match.id);
  } catch (error) {
    console.error("❌ Handle match end error:", error);
    console.error("Stack:", error.stack);
  }
};

module.exports = initializeSocket;
