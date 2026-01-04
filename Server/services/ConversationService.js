import mongoose from 'mongoose';
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
        .populate('openingMoveUser1', 'text category')
        .populate('openingMoveUser2', 'text category')
        .select('user1Id user2Id lastMessage unreadCount createdAt updatedAt openingMoveUser1 openingMoveUser2');

      // Format data for frontend
      const formatted = matches.map((match) => {
        const isUser1 = match.user1Id._id.toString() === userId;
        const partner = isUser1 ? match.user2Id : match.user1Id;
        const unreadCount = match.unreadCount.get(userId) || 0;

        // Determine partner opening move (if any)
        const partnerOpeningMove = isUser1 ? match.openingMoveUser2 : match.openingMoveUser1;

        return {
          _id: match._id,
          partnerId: partner._id,
          partnerName: partner.name,
          partnerAvatar: partner.avatar,
          partnerClass: partner.class,
          lastMessage: match.lastMessage || null,
          unreadCount,
          updatedAt: match.updatedAt,
          createdAt: match.createdAt,
          partnerOpeningMove: partnerOpeningMove ? {
            _id: partnerOpeningMove._id,
            text: partnerOpeningMove.text,
            category: partnerOpeningMove.category
          } : null
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
      // Collect messages from embedded `match.messages` (if present) and from Message collection.
      const results = [];

      // 1) If match has embedded messages array, include them first
      if (Array.isArray(match.messages) && match.messages.length > 0) {
        for (const m of match.messages) {
          results.push({
            _id: m._id || m.id || null,
            chatRoomId: matchId,
            senderId: m.senderId,
            content: m.content || '',
            attachment: m.attachment || null,
            icon: m.icon || null,
            type: m.type || 'text',
            status: m.status || 'sent',
            timestamp: m.timestamp || m.createdAt || new Date()
          });
        }
      }

      // 2) Also fetch persisted Message documents for this chatRoomId or linked chatRoomId
      const roomIds = [matchId.toString()];
      if (match.chatRoomId) roomIds.push(match.chatRoomId.toString());

      // Build a query list that includes both string ids and ObjectId variants
      const queryRoomIds = [];
      for (const id of roomIds) {
        queryRoomIds.push(id);
        try {
          if (mongoose.Types.ObjectId.isValid(id)) {
            const oid = new mongoose.Types.ObjectId(id);
            // avoid pushing duplicate when id is already an ObjectId-like string
            if (!queryRoomIds.some((v) => v instanceof mongoose.Types.ObjectId && v.equals(oid))) {
              queryRoomIds.push(oid);
            }
          }
        } catch (e) {
          // ignore invalid conversions
        }
      }

      // Debug: log roomIds we will query and embedded messages count
      try {
        console.debug('ConversationService.getMessages: matchId=', String(matchId), 'roomIds=', roomIds, 'queryRoomIds=', queryRoomIds, 'embeddedCount=', Array.isArray(match.messages) ? match.messages.length : 0);
      } catch (e) {}

      const persisted = await Message.find({ chatRoomId: { $in: queryRoomIds } })
        .populate('senderId', 'name avatar')
        .sort({ timestamp: -1, createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      try { console.debug('ConversationService.getMessages: persistedCount=', persisted.length); } catch (e) {}

      for (const m of persisted) {
        results.push({
          _id: m._id,
          chatRoomId: m.chatRoomId,
          senderId: m.senderId,
          content: m.content || '',
          attachment: m.attachment || null,
          icon: m.icon || null,
          type: m.type || 'text',
          status: m.status || 'sent',
          timestamp: m.timestamp || m.createdAt || new Date()
        });
      }

      // Deduplicate by _id if present, otherwise by timestamp+senderId
      const seen = new Map();
      const deduped = [];
      // Sort combined results oldest->newest
      results.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      for (const m of results) {
        const key = m._id ? String(m._id) : `${m.senderId}-${new Date(m.timestamp).getTime()}`;
        if (seen.has(key)) continue;
        seen.set(key, true);
        deduped.push(m);
      }

      // Apply pagination on final deduped list
      const paged = deduped.slice(Math.max(0, deduped.length - limit - skip), deduped.length - skip);

      return { success: true, messages: paged };
    } catch (error) {
      console.error('❌ Error fetching messages:', error);
      throw error;
    }
  }

  // Send a message
  async sendMessage(matchId, senderId, content, opts = {}) {
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

      // Determine message type
      const { attachment = null, icon = null } = opts || {};
      const type = attachment ? 'image' : (icon ? 'emoji' : 'text');

      // Create message in Message collection
      const newMessage = await Message.create({
        chatRoomId: matchId,
        senderId,
        content: content || '',
        attachment: attachment || null,
        icon: icon || null,
        type,
        status: 'sent',
        timestamp: new Date()
      });

      // Update last message in Match
      match.lastMessage = {
        text: attachment ? (content || '📷 Ảnh') : (icon ? `${icon} ${content || ''}` : content),
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
          attachment: newMessage.attachment,
          icon: newMessage.icon,
          type: newMessage.type,
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