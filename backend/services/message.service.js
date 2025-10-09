const prisma = require('../config/database.config');

class MessageService {
  async createMessage(matchId, senderId, senderName, content) {
    try {
    
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
     
      
      const messages = await prisma.message.findMany({
        where: { matchId },
        orderBy: { createdAt: 'asc' },
      });

     
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

     
      return result.count;
    } catch (error) {
      
      return 0;
    }
  }
}

module.exports = new MessageService();