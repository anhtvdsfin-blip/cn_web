import ConversationService from '../services/ConversationService.js';
import User from '../models/User.js';

// ----------------------------
// GET LIST CONVERSATIONS
// ----------------------------
export const getConversations = async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const result = await ConversationService.getConversations(userId);
    res.json(result);

  } catch (err) {
    console.error("❌ Error fetching conversations:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ----------------------------
// GET MESSAGES
// ----------------------------
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({ success: false, error: 'conversationId is required' });
    }

    const result = await ConversationService.getMessages(conversationId);
    res.json(result);

  } catch (err) {
    console.error("❌ Error fetching messages:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ----------------------------
// SEND MESSAGE
// ----------------------------
export const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { senderId, content } = req.body;

    if (!conversationId || !senderId || !content) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const result = await ConversationService.sendMessage(conversationId, senderId, content);
    res.json(result);

  } catch (err) {
    console.error("❌ Error sending message:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ----------------------------
// MARK AS READ
// ----------------------------
export const markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;

    if (!conversationId || !userId) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const result = await ConversationService.markAsRead(conversationId, userId);
    res.json(result);

  } catch (err) {
    console.error("❌ Error marking as read:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};