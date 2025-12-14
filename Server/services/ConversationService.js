import Match from '../models/Match.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

class ConversationService {
  // Get all conversations for a user
  async getConversations(userId) {
    try {
      const matches = await Match.find({
        $or: [{ user1Id: userId }, { user2Id: userId }],
        status: 'active'
      })
        .sort({ updatedAt: -1 })
        .populate('user1Id', 'name avatar class')
        .populate('user2Id', 'name avatar class')
        .select('user1Id user2Id lastMessage unreadCount createdAt updatedAt');

      // Format data for frontend
      const formatted = matches.map((match) => {
        const isUser1 = match.user1Id._id.toString() === userId;
        const partner = isUser1 ? match.user2Id : match.user1Id;
        const unreadCount = match.unreadCount.get(userId) || 0;

        return {
          _id: match._id,
          partnerId: partner._id,
          partnerName: partner.name,
          partnerAvatar: partner.avatar,
          partnerClass: partner.class,
          lastMessage: match.lastMessage || null,
          unreadCount,
          updatedAt: match.updatedAt,
          createdAt: match.createdAt
        };
      });

      return { success: true, conversations: formatted };
    } catch (error) {
      console.error('❌ Error fetching conversations:', error);
      throw error;
    }
  }

  // Get messages for a match (conversation)
  async getMessages(matchId, limit = 50, skip = 0) {
    try {
      const match = await Match.findById(matchId);

      if (!match) {
        return { success: false, error: 'Match not found' };
      }

      // Fetch messages from Message collection
      const messages = await Message.find({ chatRoomId: matchId })
        .populate('senderId', 'name avatar')
        .sort({ timestamp: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      // Reverse to get chronological order
      return {
        success: true,
        messages: messages.reverse()
      };
    } catch (error) {
      console.error('❌ Error fetching messages:', error);
      throw error;
    }
  }

  // Send a message
  async sendMessage(matchId, senderId, content) {
    try {
      const match = await Match.findById(matchId);

      if (!match) {
        return { success: false, error: 'Match not found' };
      }

      // Check if user is part of this match
      const isUser1 = match.user1Id.toString() === senderId;
      const isUser2 = match.user2Id.toString() === senderId;

      if (!isUser1 && !isUser2) {
        return { success: false, error: 'Unauthorized' };
      }

      // Create message in Message collection
      const newMessage = await Message.create({
        chatRoomId: matchId,
        senderId,
        content,
        type: 'text',
        status: 'sent',
        timestamp: new Date()
      });

      // Update last message in Match
      match.lastMessage = {
        text: content,
        senderId,
        timestamp: new Date()
      };

      // Reset unread count for sender, increment for receiver
      const receiverId = isUser1 ? match.user2Id : match.user1Id;
      match.unreadCount.set(senderId.toString(), 0);
      match.unreadCount.set(
        receiverId.toString(),
        (match.unreadCount.get(receiverId.toString()) || 0) + 1
      );

      match.updatedAt = new Date();
      await match.save();

      return {
        success: true,
        message: {
          _id: newMessage._id,
          senderId: newMessage.senderId,
          content: newMessage.content,
          timestamp: newMessage.timestamp,
          status: newMessage.status
        }
      };
    } catch (error) {
      console.error('❌ Error sending message:', error);
      throw error;
    }
  }

  // Mark conversation as read
  async markAsRead(matchId, userId) {
    try {
      const match = await Match.findById(matchId);

      if (!match) {
        return { success: false, error: 'Match not found' };
      }

      // Mark all unread messages from other user as read
      const receiverId = match.user1Id.toString() === userId ? match.user2Id : match.user1Id;
      
      await Message.updateMany(
        { chatRoomId: matchId, senderId: receiverId, status: { $ne: 'read' } },
        { status: 'read' }
      );

      // Reset unread count for this user
      match.unreadCount.set(userId.toString(), 0);
      await match.save();

      return { success: true };
    } catch (error) {
      console.error('❌ Error marking as read:', error);
      throw error;
    }
  }

  // Delete conversation (block/close)
  async deleteConversation(matchId) {
    try {
      const match = await Match.findByIdAndUpdate(
        matchId,
        { status: 'closed' },
        { new: true }
      );

      if (!match) {
        return { success: false, error: 'Match not found' };
      }

      return { success: true, match };
    } catch (error) {
      console.error('❌ Error deleting conversation:', error);
      throw error;
    }
  }

  // Get typing status
  async getTypingStatus(matchId) {
    try {
      const match = await Match.findById(matchId).select('typing');

      if (!match) {
        return { success: false, error: 'Match not found' };
      }

      return {
        success: true,
        typing: Object.fromEntries(match.typing || new Map())
      };
    } catch (error) {
      console.error('❌ Error getting typing status:', error);
      throw error;
    }
  }

  // Update typing status
  async updateTypingStatus(matchId, userId, isTyping) {
    try {
      const match = await Match.findById(matchId);

      if (!match) {
        return { success: false, error: 'Match not found' };
      }

      match.typing.set(userId.toString(), isTyping);
      match.markModified('typing');
      await match.save();

      return {
        success: true,
        typing: Object.fromEntries(match.typing)
      };
    } catch (error) {
      console.error('❌ Error updating typing status:', error);
      throw error;
    }
  }
}

export default new ConversationService();
