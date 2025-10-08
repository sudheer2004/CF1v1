const prisma = require('../config/database.config');

class MessageService {
  async createMessage(matchId, senderId, senderName, content) {
    try {
      console.log('📝 Creating message:', {
        matchId,
        senderId,
        senderName,
        contentLength: content?.length
      });

      // Validate inputs
      if (!matchId || !senderId || !senderName || !content) {
        throw new Error(`Missing required fields: matchId=${!!matchId}, senderId=${!!senderId}, senderName=${!!senderName}, content=${!!content}`);
      }

      const message = await prisma.message.create({
        data: {
          matchId,
          senderId,
          senderName,
          content,
        },
      });

      console.log('✅ Message created successfully:', message.id);
      return message;
    } catch (error) {
      console.error('❌ Error creating message:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        meta: error.meta
      });
      throw new Error(`Failed to create message: ${error.message}`);
    }
  }

  async getMatchMessages(matchId) {
    try {
      console.log('📨 Fetching messages for match:', matchId);
      
      const messages = await prisma.message.findMany({
        where: { matchId },
        orderBy: { createdAt: 'asc' },
      });

      console.log(`✅ Found ${messages.length} messages for match ${matchId}`);
      return messages;
    } catch (error) {
      console.error('❌ Error fetching messages:', error);
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }
  }

  async deleteMatchMessages(matchId) {
    try {
      const result = await prisma.message.deleteMany({
        where: { matchId },
      });

      console.log(`🗑️ Deleted ${result.count} messages for match: ${matchId}`);
      return result.count;
    } catch (error) {
      console.error('❌ Error deleting messages:', error);
      // Don't throw - just log the error
      return 0;
    }
  }

  async cleanupOldMessages() {
    try {
      // Delete messages older than 24 hours from completed matches
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const result = await prisma.message.deleteMany({
        where: {
          createdAt: {
            lt: oneDayAgo,
          },
        },
      });

      console.log(`🧹 Cleaned up ${result.count} old messages`);
      return result.count;
    } catch (error) {
      console.error('❌ Error cleaning up old messages:', error);
      return 0;
    }
  }
}

module.exports = new MessageService();