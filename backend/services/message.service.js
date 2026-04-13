const prisma = require("../config/database.config");

class MessageService {
  async createMessage(matchId, senderId, senderName, content) {
    try {
      if (!matchId || !senderId || !senderName || !content) {
        throw new Error(
          `Missing required fields: matchId=${!!matchId}, senderId=${!!senderId}, senderName=${!!senderName}, content=${!!content}`,
        );
      }

      const message = await prisma.message.create({
        data: { matchId, senderId, senderName, content },
      });

      return message;
    } catch (error) {
      console.error("❌ Error creating message:", error);
      throw new Error(`Failed to create message: ${error.message}`);
    }
  }

  async createGlobalMessage(senderId, content) {
    try {
      if (!senderId) throw new Error("senderId is required");
      if (!content || !content.trim()) throw new Error("content is required");

      const user = await prisma.user.findUnique({
        where: { id: senderId },
        select: { id: true, username: true },
      });

      if (!user) throw new Error(`User not found for id: ${senderId}`);

      const message = await prisma.globalMessage.create({
        data: {
          content: content.trim(),
          senderId: user.id,
          senderName: user.username,
        },
      });

      return message;
    } catch (error) {
      console.error("❌ Error creating global message:", error);
      throw new Error(`Failed to create global message: ${error.message}`);
    }
  }

  // Edit a global message (only by owner, within 15 minutes)
  async editGlobalMessage(messageId, userId, newContent) {
    try {
      if (!messageId || !userId || !newContent?.trim()) {
        throw new Error("messageId, userId, and content are required");
      }

      const message = await prisma.globalMessage.findUnique({
        where: { id: messageId },
      });

      if (!message) throw new Error("Message not found");
      if (message.senderId !== userId) throw new Error("Unauthorized");
      if (message.isDeleted) throw new Error("Message already deleted");

      // 15 minute edit window
      const fifteenMinutes = 15 * 60 * 1000;
      if (Date.now() - new Date(message.createdAt).getTime() > fifteenMinutes) {
        throw new Error("Edit window has expired (15 minutes)");
      }

      const updated = await prisma.globalMessage.update({
        where: { id: messageId },
        data: {
          content: newContent.trim(),
          isEdited: true,
        },
        // Return only the fields clients need
        select: {
          id: true,
          content: true,
          senderId: true,
          senderName: true,
          createdAt: true,
          isEdited: true,
          isDeleted: true,
        },
      });

      return updated;
    } catch (error) {
      console.error("❌ Error editing global message:", error);
      throw error;
    }
  }

  // Delete a global message (only by owner, anytime)
  async deleteGlobalMessage(messageId, userId) {
    try {
      if (!messageId || !userId) {
        throw new Error("messageId and userId are required");
      }

      const message = await prisma.globalMessage.findUnique({
        where: { id: messageId },
      });

      if (!message) throw new Error("Message not found");
      if (message.senderId !== userId) throw new Error("Unauthorized");
      if (message.isDeleted) throw new Error("Message already deleted");

      const deletedMessage = await prisma.globalMessage.update({
        where: { id: messageId },
        data: {
          isDeleted: true,
        },
        select: {
          id: true,
          content: true,
          senderId: true,
          senderName: true,
          createdAt: true,
          isEdited: true,
          isDeleted: true,
        },
      });

      return deletedMessage;
    } catch (error) {
      console.error("❌ Error deleting global message:", error);
      throw error;
    }
  }

  // Get paginated global messages (newest first, reversed for display)
  async getGlobalMessages(limit = 50, offset = 0) {
    try {
      const messages = await prisma.globalMessage.findMany({
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          content: true,
          senderId: true,
          senderName: true,
          createdAt: true,
          isEdited: true,
          isDeleted: true,
        },
      });

      // Reverse so oldest-first for chronological display
      return messages.reverse();
    } catch (error) {
      console.error("❌ Error fetching global messages:", error);
      throw new Error(`Failed to fetch global messages: ${error.message}`);
    }
  }

  async getGlobalMessageCount() {
    try {
      return await prisma.globalMessage.count({
        where: { isDeleted: false },
      });
    } catch (error) {
      console.error("❌ Error counting global messages:", error);
      return 0;
    }
  }

  async getMatchMessages(matchId) {
    try {
      return await prisma.message.findMany({
        where: { matchId },
        orderBy: { createdAt: "asc" },
      });
    } catch (error) {
      console.error("❌ Error fetching messages:", error);
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }
  }

  async deleteMatchMessages(matchId) {
    try {
      const result = await prisma.message.deleteMany({ where: { matchId } });
      return result.count;
    } catch (error) {
      console.error("❌ Error deleting messages:", error);
      return 0;
    }
  }

  async cleanupOldMessages() {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      const result = await prisma.message.deleteMany({
        where: { createdAt: { lt: oneDayAgo } },
      });
      console.log(`🧹 Cleaned up ${result.count} old match messages`);
      return result.count;
    } catch (error) {
      console.error("❌ Error cleaning up old match messages:", error);
      return 0;
    }
  }

  async cleanupOldGlobalMessages() {
    try {
      const retentionDays = parseInt(
        process.env.GLOBAL_MESSAGE_RETENTION_DAYS || "30",
      );
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const result = await prisma.globalMessage.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          isDeleted: true,
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
