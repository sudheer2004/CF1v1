const prisma = require("../config/database.config");
const userService = require("../services/user.service");

class MessageService {
  async createMessage(matchId, senderId, senderName, content) {
    try {
      // Validate inputs
      if (!matchId || !senderId || !senderName || !content) {
        throw new Error(
          `Missing required fields: matchId=${!!matchId}, senderId=${!!senderId}, senderName=${!!senderName}, content=${!!content}`,
        );
      }

      const message = await prisma.message.create({
        data: {
          matchId,
          senderId,
          senderName,
          content,
        },
      });

      return message;
    } catch (error) {
      console.error("❌ Error creating message:", error);
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        code: error.code,
        meta: error.meta,
      });
      throw new Error(`Failed to create message: ${error.message}`);
    }
  }

  async createGlobalMessage(senderId, content) {
    try {
      if (!senderId) throw new Error("senderId is required");
      if (!content || !content.trim()) throw new Error("content is required");

      // Fetch minimal fields needed
      const user = await prisma.user.findUnique({
        where: { id: senderId },
        select: { id: true, username: true },
      });

      if (!user) {
        throw new Error(`User not found for id: ${senderId}`);
      }

      const message = await prisma.globalMessage.create({
        data: {
          content: content.trim(),
          senderId: user.id, // use FK
          senderName: user.username, // de-normalized
        },
      });

      return message;
    } catch (error) {
      console.error("❌ Error creating global message:", error);
      throw new Error(`Failed to create global message: ${error.message}`);
    }
  }

  // NEW: Get paginated global messages (newest first)
  async getGlobalMessages(limit = 50, offset = 0) {
    try {
      const messages = await prisma.globalMessage.findMany({
        orderBy: { createdAt: "desc" }, // Newest first
        take: limit,
        skip: offset,
        select: {
          id: true,
          content: true,
          senderId: true,
          senderName: true,
          createdAt: true,
        },
      });

      // Reverse to show oldest first in UI (chronological order)
      return messages.reverse();
    } catch (error) {
      console.error("❌ Error fetching global messages:", error);
      throw new Error(`Failed to fetch global messages: ${error.message}`);
    }
  }

  // NEW: Get total count of global messages
  async getGlobalMessageCount() {
    try {
      const count = await prisma.globalMessage.count();
      return count;
    } catch (error) {
      console.error("❌ Error counting global messages:", error);
      return 0;
    }
  }

  async getMatchMessages(matchId) {
    try {
      const messages = await prisma.message.findMany({
        where: { matchId },
        orderBy: { createdAt: "asc" },
      });

      return messages;
    } catch (error) {
      console.error("❌ Error fetching messages:", error);
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }
  }

  async deleteMatchMessages(matchId) {
    try {
      const result = await prisma.message.deleteMany({
        where: { matchId },
      });

      return result.count;
    } catch (error) {
      console.error("❌ Error deleting messages:", error);
      // Don't throw - just log the error
      return 0;
    }
  }

  // UPDATED: Cleanup old match messages (24 hours)
  async cleanupOldMessages() {
    try {
      // Delete match messages older than 24 hours
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const result = await prisma.message.deleteMany({
        where: {
          createdAt: {
            lt: oneDayAgo,
          },
        },
      });

      console.log(`🧹 Cleaned up ${result.count} old match messages`);
      return result.count;
    } catch (error) {
      console.error("❌ Error cleaning up old match messages:", error);
      return 0;
    }
  }

  // NEW: Cleanup old global messages based on retention period
  async cleanupOldGlobalMessages() {
    try {
      const retentionDays = parseInt(
        process.env.GLOBAL_MESSAGE_RETENTION_DAYS || "30",
      );

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await prisma.globalMessage.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      console.log(
        `🧹 Cleaned up ${result.count} global messages older than ${retentionDays} days`,
      );
      return result.count;
    } catch (error) {
      console.error("❌ Error cleaning up old global messages:", error);
      return 0;
    }
  }
}

module.exports = new MessageService();